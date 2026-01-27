#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
from koheron import command, connect
import matplotlib.pyplot as plt
import numpy as np

N_PTS = 64 * 1024      # words per descriptor
N_DESC_MAX = 256

class AdcDacDma(object):
    def __init__(self, client):
        self.client = client
        self.n = 0
        self.dac = np.zeros((0,))
        self.adc = np.zeros((0,))

    @command()
    def select_adc_channel(self, channel):
        pass

    @command()
    def set_dac_data(self, data):
        pass

    def set_dac(self, warning=False, reset=False):
        if warning:
            if np.max(np.abs(self.dac)) >= 1:
                print('WARNING : dac out of bounds')
        dac_data = np.uint32(np.mod(np.floor(32768 * self.dac) + 32768, 65536) + 32768)
        self.set_dac_data(dac_data[::2] + 65536 * dac_data[1::2])

    @command()
    def start_dma(self, N):
        pass

    @command()
    def stop_dma(self):
        pass

    @command()
    def get_adc_data_n(self, N):
        # server sends exactly N*n_pts uint32 words
        return self.client.recv_vector(dtype='uint32', check_type=False)

    def _resize_for_desc(self, N):
        self.n = 2 * N_PTS * N
        self.dac = np.zeros((self.n,))
        self.adc = np.zeros((self.n,))

    def get_adc(self, N):
        N = int(N)
        if N < 1: N = 1
        if N > N_DESC_MAX: N = N_DESC_MAX

        self._resize_for_desc(N)

        self.start_dma(N)
        data = self.get_adc_data_n(N)
        self.stop_dma()

        self.adc[::2]  = (np.int32(data & 65535) - 32768) % 65536 - 32768
        self.adc[1::2] = (np.int32(data >> 16)   - 32768) % 65536 - 32768

    # keep compatibility name
    def get_adc_span(self, N):
        self.get_adc(N)

if __name__=="__main__":
    host = os.getenv('HOST','192.168.1.98')
    client = connect(host, name='adc-dac-dma', restart=False)
    driver = AdcDacDma(client)

    adc_channel = 0
    driver.select_adc_channel(adc_channel)

    N = 1  # capture length in descriptors

    fs = 250e6
    fmin = 1e3
    fmax = 1e6

    driver._resize_for_desc(N)
    t = np.arange(driver.n) / fs
    chirp = (fmax-fmin)/(t[-1]-t[0])

    print("Set DAC waveform (chirp between {} and {} MHz)".format(1e-6*fmin, 1e-6*fmax))
    driver.dac = 0.9 * np.cos(2*np.pi * (fmin + chirp * t) * t)
    driver.set_dac(warning=True)

    print("Get ADC data ({} points)".format(driver.n))
    driver.get_adc(N)

    n_pts = 500

    plt.ion()
    figure, ax = plt.subplots(figsize=(10,8))
    line1, = ax.plot(1e6 * t[0:n_pts], driver.adc[0:n_pts])
    plt.title("ADC Values")
    plt.xlabel("Time (us)")
    plt.ylabel("ADC Value")

    try:
        while(True):
            driver.get_adc(N)
            line1.set_xdata(1e6 * t[0:n_pts])
            line1.set_ydata(driver.adc[0:n_pts])
            figure.canvas.draw()
            figure.canvas.flush_events()


    except KeyboardInterrupt:
        pass