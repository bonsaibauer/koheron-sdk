#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import argparse
from koheron import command, connect
import matplotlib.pyplot as plt
import numpy as np

# DMA returns N*N_PTS uint32 words, each packing 2 int16 samples
N_PTS = 64 * 1024
N_DESC_MAX = 256


class AdcDacDma(object):
    def __init__(self, client):
        self.client = client
        self.n = 0
        self.dac = np.zeros((0,), dtype=np.float64)
        self.adc = np.zeros((0,), dtype=np.float64)
        self._alloc_N = None

    @command()
    def select_adc_channel(self, channel):
        pass

    @command()
    def set_dac_data(self, data):
        pass

    def set_dac(self, warning=False):
        if warning and self.dac.size:
            if np.max(np.abs(self.dac)) >= 1.0:
                print("WARNING: dac out of bounds; clipping")

        s = np.clip(self.dac, -1.0, 0.999969482421875)
        i16 = np.round(s * 32767.0).astype(np.int16)
        u16 = i16.view(np.uint16).astype(np.uint32)
        # expects even number of samples
        packed = u16[::2] | (u16[1::2] << 16)
        self.set_dac_data(packed)

    @command()
    def start_dma(self, N):
        pass

    @command()
    def stop_dma(self):
        pass

    @command()
    def get_adc_data_n(self, N):
        return self.client.recv_vector(dtype='uint32', check_type=False)

    def ensure_alloc(self, N):
        """Allocate buffers only if N changes."""
        N = int(N)
        if N < 1:
            N = 1
        if N > N_DESC_MAX:
            N = N_DESC_MAX

        if self._alloc_N == N:
            return N

        self._alloc_N = N
        self.n = 2 * N_PTS * N  # int16 samples after unpack
        # IMPORTANT: do NOT overwrite dac unless you really want to reset it
        self.dac = np.zeros((self.n,), dtype=np.float64)
        self.adc = np.zeros((self.n,), dtype=np.float64)
        return N

    def capture_adc(self, N):
        """Capture only; does NOT resize or touch dac."""
        N = int(N)
        self.start_dma(N)
        data = self.get_adc_data_n(N)  # length = N*N_PTS uint32
        self.stop_dma()

        lo = (data & 0xFFFF).astype(np.uint16)
        hi = (data >> 16).astype(np.uint16)

        self.adc[::2] = lo.view(np.int16).astype(np.float64)
        self.adc[1::2] = hi.view(np.int16).astype(np.float64)


def estimate_delay_and_remove(H, f, fs, band_lo=1e6, band_hi=5e7, mask=None):
    ph = np.unwrap(np.angle(H))
    band = (f >= band_lo) & (f <= band_hi)
    if mask is not None:
        band &= mask
    if np.count_nonzero(band) < 10:
        return H, 0.0

    a, _b = np.polyfit(f[band], ph[band], 1)
    tau = -a / (2.0 * np.pi)
    H_corr = H * np.exp(1j * 2.0 * np.pi * f * tau)

    print(f"Estimated delay: {tau*1e9:.1f} ns  ({tau*fs:.1f} samples)")
    return H_corr, tau


def bode_estimate(driver, N, fs, n_acq=200, amp=0.9, k0=1,
                  band_lo=1e6, band_hi=5e7, thr_rel=1e-6,
                  remove_delay=True, seed=None, verbose=False):
    """
    Returns: f, H (complex), mask (bool), debug dict
    """
    n_samp = driver.n               # int16 samples available in buffers
    # Use the first half-record if you want: set n_fft = N*N_PTS (legacy)
    # Here we default to a consistent "words->FFT" behavior matching your original:
    n_fft = N * N_PTS               # number of *samples* used in FFT below (legacy choice)
    # If you prefer full capture in samples, use:
    # n_fft = 2 * N * N_PTS

    if n_fft > n_samp:
        raise RuntimeError(f"n_fft ({n_fft}) > available samples ({n_samp})")

    f = np.fft.rfftfreq(n_fft, d=1.0 / fs)
    window = np.hanning(n_fft)

    Sxx = np.zeros_like(f, dtype=np.float64)
    Syx = np.zeros_like(f, dtype=np.complex128)

    rng = np.random.default_rng(seed)

    for k in range(n_acq):
        # fresh DAC buffer (white)
        white = rng.normal(size=driver.n)
        white /= (np.max(np.abs(white)) + 1e-12)
        driver.dac = amp * white
        driver.set_dac(warning=(k == 0))

        # capture ADC
        driver.capture_adc(N)

        x = driver.dac[:n_fft] * window
        y = driver.adc[:n_fft] * window

        X = np.fft.rfft(x)
        Y = np.fft.rfft(y)

        Sxx = (Sxx * k + (np.abs(X) ** 2)) / (k + 1)
        Syx = (Syx * k + (Y * np.conj(X))) / (k + 1)

        if verbose and (k % max(1, n_acq // 5) == 0):
            print(f"avg {k+1}/{n_acq}")

    H = Syx / (Sxx + 1e-30)
    mask = Sxx > (thr_rel * np.max(Sxx))

    tau = 0.0
    H_used = H
    if remove_delay:
        H_used, tau = estimate_delay_and_remove(H, f, fs, band_lo=band_lo, band_hi=band_hi, mask=mask)

    dbg = {"Sxx": Sxx, "Syx": Syx, "tau": tau, "n_fft": n_fft}
    return f, H_used, mask, dbg


def save_baseline(path, f, H, mask, meta=None):
    np.savez(
        path,
        f=f.astype(np.float64),
        H_real=H.real.astype(np.float64),
        H_imag=H.imag.astype(np.float64),
        mask=mask.astype(np.bool_),
        meta=np.array([meta], dtype=object),
    )
    print(f"Saved baseline: {path}")


def load_baseline(path):
    d = np.load(path, allow_pickle=True)
    f = d["f"]
    H = d["H_real"] + 1j * d["H_imag"]
    mask = d["mask"]
    meta = d["meta"][0] if "meta" in d else None
    return f, H, mask, meta


def apply_baseline_correction(H_meas, H0, mask0=None, eps=1e-12):
    denom = H0.copy()

    if mask0 is not None:
        denom = np.where(mask0, denom, np.nan + 1j * np.nan)

    mag = np.abs(denom)
    denom = np.where(mag > eps, denom, np.nan + 1j * np.nan)

    return H_meas / denom


def main():
    ap = argparse.ArgumentParser(
        description="Koheron ADC/DAC DMA Bode estimate with optional baseline correction"
    )
    ap.add_argument("--host", default=os.getenv("HOST", "192.168.1.98"))
    ap.add_argument("--name", default="adc-dac-dma")
    ap.add_argument("--adc-channel", type=int, default=0)
    ap.add_argument("--fs", type=float, default=250e6)
    ap.add_argument("--N", type=int, default=1)
    ap.add_argument("--n-acq", type=int, default=200)
    ap.add_argument("--amp", type=float, default=0.9)
    ap.add_argument("--band-lo", type=float, default=1e6)
    ap.add_argument("--band-hi", type=float, default=5e7)
    ap.add_argument("--thr-rel", type=float, default=1e-6)
    ap.add_argument("--no-delay-remove", action="store_true", help="do not remove bulk delay")
    ap.add_argument("--mode", choices=["baseline", "dut"], default="dut")
    ap.add_argument("--baseline-path", default="baseline.npz", help="baseline file path to save/load")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--no-gui", action="store_true", help="run once and print summary (no live plot)")
    args = ap.parse_args()

    client = connect(args.host, name=args.name, restart=False)
    driver = AdcDacDma(client)
    driver.select_adc_channel(args.adc_channel)
    N = driver.ensure_alloc(args.N)

    remove_delay = not args.no_delay_remove

    if args.mode == "baseline":
        f0, H0, mask0, dbg0 = bode_estimate(
            driver, N, args.fs,
            n_acq=args.n_acq,
            amp=args.amp,
            band_lo=args.band_lo,
            band_hi=args.band_hi,
            thr_rel=args.thr_rel,
            remove_delay=remove_delay,
            seed=args.seed,
            verbose=True,
        )
        meta = {
            "host": args.host,
            "name": args.name,
            "adc_channel": args.adc_channel,
            "fs": args.fs,
            "N": N,
            "n_acq": args.n_acq,
            "amp": args.amp,
            "band_lo": args.band_lo,
            "band_hi": args.band_hi,
            "thr_rel": args.thr_rel,
            "delay_removed": remove_delay,
            "n_fft": dbg0["n_fft"],
        }
        save_baseline(args.baseline_path, f0, H0, mask0, meta=meta)

        if args.no_gui:
            print("Baseline done.")
            return

        # show baseline plot
        k0 = 1
        mag_db = 20 * np.log10(np.abs(H0[k0:]) + 1e-12)
        phase = np.unwrap(np.angle(H0[k0:]))

        plt.figure(figsize=(10, 8))
        plt.subplot(2, 1, 1)
        plt.semilogx(f0[k0:], mag_db)
        plt.grid(True, which="both", linestyle="--", alpha=0.4)
        plt.ylabel("Magnitude (dB)")
        plt.title("Baseline H0(f)")

        plt.subplot(2, 1, 2)
        plt.semilogx(f0[k0:], phase)
        plt.grid(True, which="both", linestyle="--", alpha=0.4)
        plt.xlabel("Frequency (Hz)")
        plt.ylabel("Phase (rad)")

        plt.show()
        return

    # DUT mode
    f, H_meas, mask, dbg = bode_estimate(
        driver, N, args.fs,
        n_acq=args.n_acq,
        amp=args.amp,
        band_lo=args.band_lo,
        band_hi=args.band_hi,
        thr_rel=args.thr_rel,
        remove_delay=remove_delay,
        seed=args.seed,
        verbose=True,
    )

    # Optional correction
    H_plot = H_meas
    title = "Measured H(f)"

    if args.baseline_path and os.path.exists(args.baseline_path):
        f0, H0, mask0, meta0 = load_baseline(args.baseline_path)

        # sanity checks
        if f0.shape != f.shape or np.max(np.abs(f0 - f)) != 0.0:
            raise RuntimeError(
                "Baseline frequency grid doesn't match. "
                "Ensure fs/N/FFT length are identical to baseline acquisition."
            )

        H_corr = apply_baseline_correction(H_meas, H0, mask0=mask0)
        H_plot = H_corr
        title = "Corrected H(f) = H_meas / H0"

        if meta0 is not None:
            print("Loaded baseline meta:", meta0)

    # Plot
    k0 = 1
    mag_db = 20 * np.log10(np.abs(H_plot[k0:]) + 1e-12)
    phase = np.unwrap(np.angle(H_plot[k0:]))

    if args.no_gui:
        print(f"{title}:")
        print(f"  mag(dB) @ {f[k0]:.1f} Hz: {mag_db[0]:.2f}")
        return

    plt.ion()
    fig, (ax_mag, ax_phase) = plt.subplots(2, 1, figsize=(10, 8), sharex=True)
    fig.suptitle(title)

    mag_line, = ax_mag.semilogx(f[k0:], mag_db)
    ax_mag.set_ylabel("Magnitude (dB)")
    ax_mag.grid(True, which="both", linestyle="--", alpha=0.4)

    phase_line, = ax_phase.semilogx(f[k0:], phase)
    ax_phase.set_xlabel("Frequency (Hz)")
    ax_phase.set_ylabel("Phase (rad)")
    ax_phase.grid(True, which="both", linestyle="--", alpha=0.4)

    ax_mag.relim(); ax_mag.autoscale_view()
    ax_phase.relim(); ax_phase.autoscale_view()
    fig.canvas.draw()
    fig.canvas.flush_events()

    plt.ioff()
    plt.show()


if __name__ == "__main__":
    main()