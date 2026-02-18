source $board_path/config/ports.tcl

# Add PS and AXI Interconnect
set board_preset $board_path/config/board_preset.tcl
source $sdk_path/fpga/lib/starting_point.tcl

# Add ADCs and DACs
source $sdk_path/fpga/lib/redp_adc_dac.tcl
set adc_dac_name adc_dac
add_redp_adc_dac $adc_dac_name

set adc_clk $adc_dac_name/adc_clk

# Add processor system reset synchronous to adc clock
set rst_adc_clk_name proc_sys_reset_adc_clk
cell xilinx.com:ip:proc_sys_reset:5.0 $rst_adc_clk_name {} {
  ext_reset_in $ps_name/FCLK_RESET0_N
  slowest_sync_clk $adc_clk
}

# Add config and status registers
source $sdk_path/fpga/lib/ctl_sts.tcl
add_ctl_sts $adc_clk $rst_adc_clk_name/peripheral_aresetn

# Connect LEDs
connect_port_pin led_o [get_slice_pin [ctl_pin led] 7 0]

# Single tone generation for DAC1
cell xilinx.com:ip:dds_compiler:6.0 dds {
  Parameter_Entry Hardware_Parameters
  Phase_Width 32
  Output_Width 14
  Phase_Increment Streaming
  Has_Phase_Out false
} {
  aclk $adc_clk
}

connect_pins dds/s_axis_phase_tdata [ctl_pin dds_freq_hz]
connect_pins dds/s_axis_phase_tvalid [get_constant_pin 1 1]
connect_pins adc_dac/dac1 [get_slice_pin dds/m_axis_data_tdata 13 0]
connect_pins adc_dac/dac2 [get_constant_pin 14 0]

# Expose ADC1 raw data in status register
connect_pins [sts_pin adc_amplitude] adc_dac/adc1
