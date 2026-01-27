#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
from koheron import command, connect
import matplotlib.pyplot as plt
import numpy as np

N_PTS = 64 * 1024      # uint32 words per descriptor (each packs 2 int16 samples)
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
        if N < 1: N = 1
        if N > N_DESC_MAX: N = N_DESC_MAX

        if self._alloc_N == N:
            return N

        self._alloc_N = N
        self.n = 2 * N_PTS * N
        # IMPORTANT: do NOT overwrite dac unless you really want to reset it
        self.dac = np.zeros((self.n,), dtype=np.float64)
        self.adc = np.zeros((self.n,), dtype=np.float64)
        return N

    def capture_adc(self, N):
        """Capture only; does NOT resize or touch dac."""
        N = int(N)
        self.start_dma(N)
        data = self.get_adc_data_n(N)   # length = N*N_PTS uint32
        self.stop_dma()

        lo = (data & 0xFFFF).astype(np.uint16)
        hi = (data >> 16).astype(np.uint16)

        self.adc[::2]  = lo.view(np.int16).astype(np.float64)
        self.adc[1::2] = hi.view(np.int16).astype(np.float64)

def estimate_delay_and_remove(H, f, fs, band_lo=1e6, band_hi=5e7, mask=None):
    ph = np.unwrap(np.angle(H))
    band = (f >= band_lo) & (f <= band_hi)
    if mask is not None:
        band &= mask
    if np.count_nonzero(band) < 10:
        return H, 0.0

    a, b = np.polyfit(f[band], ph[band], 1)
    tau = -a / (2.0 * np.pi)
    H_corr = H * np.exp(1j * 2.0 * np.pi * f * tau)

    print(f"Estimated delay: {tau*1e9:.1f} ns  ({tau*fs:.1f} samples)")
    return H_corr, tau

if __name__ == "__main__":
    host = os.getenv("HOST", "192.168.1.98")
    client = connect(host, name="adc-dac-dma", restart=False)
    driver = AdcDacDma(client)

    adc_channel = 0
    driver.select_adc_channel(adc_channel)

    N = 1
    fs = 250e6

    N = driver.ensure_alloc(N)
    n_pts = N * N_PTS          # uint32 words in record
    f = np.fft.rfftfreq(n_pts, d=1.0/fs)
    window = np.hanning(n_pts)

    k0 = 1
    f1 = f[k0:]

    plt.ion()
    fig, (ax_mag, ax_phase) = plt.subplots(2, 1, figsize=(10, 8), sharex=True)
    fig.suptitle("Bode estimate (white noise excitation, delay removed)")

    mag_line, = ax_mag.semilogx(f1, np.zeros_like(f1))
    ax_mag.set_ylabel("Magnitude (dB)")
    ax_mag.grid(True, which="both", linestyle="--", alpha=0.4)

    phase_line, = ax_phase.semilogx(f1, np.zeros_like(f1))
    ax_phase.set_xlabel("Frequency (Hz)")
    ax_phase.set_ylabel("Phase (rad)")
    ax_phase.grid(True, which="both", linestyle="--", alpha=0.4)

    Sxx = np.zeros_like(f, dtype=np.float64)
    Syx = np.zeros_like(f, dtype=np.complex128)

    rng = np.random.default_rng()
    n_acq = 200

    for k in range(n_acq):
        # Generate + push a fresh DAC buffer
        white = rng.normal(size=driver.n)
        white /= (np.max(np.abs(white)) + 1e-12)
        driver.dac = 0.9 * white
        driver.set_dac(warning=True)

        # Capture ADC (DOES NOT touch driver.dac anymore)
        driver.capture_adc(N)

        # Use first n_pts samples (match your original intent)
        x = driver.dac[:n_pts] * window
        y = driver.adc[:n_pts] * window

        X = np.fft.rfft(x)
        Y = np.fft.rfft(y)

        Sxx = (Sxx * k + (np.abs(X) ** 2)) / (k + 1)
        Syx = (Syx * k + (Y * np.conj(X))) / (k + 1)

        H = Syx / (Sxx + 1e-30)
        mask = Sxx > (1e-8 * np.max(Sxx))

        H_corr, tau = estimate_delay_and_remove(H, f, fs, band_lo=1e6, band_hi=5e7, mask=mask)

        mag_db = 20*np.log10(np.abs(H_corr[k0:]) + 1e-12)
        phase = np.unwrap(np.angle(H_corr[k0:]))

        mag_line.set_ydata(mag_db)
        phase_line.set_ydata(phase)

        if (k == 0):
            ax_mag.relim(); ax_mag.autoscale_view()
            ax_phase.relim(); ax_phase.autoscale_view()

        if (k % 5) == 0:
            fig.canvas.draw()
            fig.canvas.flush_events()

    plt.ioff()
    plt.show()
