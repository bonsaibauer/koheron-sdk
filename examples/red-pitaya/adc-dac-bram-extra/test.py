#!/usr/bin/env python
# -*- coding: utf-8 -*-

import numpy as np
import os
import time
from connector import AdcDacBram
from koheron import connect

import matplotlib
matplotlib.use('TKAgg')
from matplotlib import pyplot as plt
from matplotlib.lines import Line2D

host = os.getenv('HOST', 'koheron')
client = connect(host, 'adc-dac-bram-extra', restart=False)
driver = AdcDacBram(client)


driver.set_dac_function(1,30000)
print(driver.get_config_as_text())



print('DAC size = {}'.format(driver.dac_size))
print('ADC size = {}'.format(driver.adc_size))

averaging_width=10


# Dynamic plot
fig = plt.figure()
ax = fig.add_subplot(111)
y = np.zeros(driver.adc_size)
line0 = Line2D([], [], color='blue', label='ADC0')
line1 = Line2D([], [], color='green', label='ADC1')
ax.add_line(line0)
ax.add_line(line1)
ax.set_xlabel('Time (us)')
ax.set_ylabel('ADC Raw data')
ax.set_xlim((0,driver.dac_size/averaging_width))
ax.set_ylim((-2**13, 2**13))
ax.axvspan(0, driver.getlen()/averaging_width, facecolor='yellow', alpha=0.3, label='Sequentielle Ausgabe')
ax.legend()
fig.canvas.draw()

count = 0

k=True

res1=np.zeros(np.floor(driver.dac_size/averaging_width).astype(int))
res2=np.zeros(np.floor(driver.dac_size/averaging_width).astype(int))

while plt.fignum_exists(fig.number):
    try:
        count+=1
        fig.canvas.manager.set_window_title(str(count))
        driver.get_adc()
        
        for i in range(len(res1)):
            res1[i]=0
            res2[i]=0
            for j in range(averaging_width):
                res1[i]+=driver.adc[0,:][i*averaging_width+j]/averaging_width
                res2[i]+=driver.adc[1,:][i*averaging_width+j]/averaging_width
        line0.set_data(list(range(len(res1))),res1)
        line1.set_data(list(range(len(res2))),res2)
        fig.canvas.draw()
        plt.pause(0.001)
    except KeyboardInterrupt:
        break
