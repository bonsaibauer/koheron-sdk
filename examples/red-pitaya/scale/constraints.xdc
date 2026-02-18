set_property CFGBVS VCCO [current_design]
set_property CONFIG_VOLTAGE 3.3 [current_design]

set_property IOSTANDARD DIFF_HSTL_I_18 [get_ports adc_clk_p_i]
set_property IOSTANDARD DIFF_HSTL_I_18 [get_ports adc_clk_n_i]
set_property PACKAGE_PIN U18 [get_ports adc_clk_p_i]
set_property PACKAGE_PIN U19 [get_ports adc_clk_n_i]

set_property IOSTANDARD LVCMOS18 [get_ports {adc_dat_a_i[*]}]
set_property IOB TRUE [get_ports {adc_dat_a_i[*]}]

set_property PACKAGE_PIN Y17 [get_ports {adc_dat_a_i[0]}]
set_property PACKAGE_PIN W16 [get_ports {adc_dat_a_i[1]}]
set_property PACKAGE_PIN Y16 [get_ports {adc_dat_a_i[2]}]
set_property PACKAGE_PIN W15 [get_ports {adc_dat_a_i[3]}]
set_property PACKAGE_PIN W14 [get_ports {adc_dat_a_i[4]}]
set_property PACKAGE_PIN Y14 [get_ports {adc_dat_a_i[5]}]
set_property PACKAGE_PIN W13 [get_ports {adc_dat_a_i[6]}]
set_property PACKAGE_PIN V12 [get_ports {adc_dat_a_i[7]}]
set_property PACKAGE_PIN V13 [get_ports {adc_dat_a_i[8]}]
set_property PACKAGE_PIN T14 [get_ports {adc_dat_a_i[9]}]
set_property PACKAGE_PIN T15 [get_ports {adc_dat_a_i[10]}]
set_property PACKAGE_PIN V15 [get_ports {adc_dat_a_i[11]}]
set_property PACKAGE_PIN T16 [get_ports {adc_dat_a_i[12]}]
set_property PACKAGE_PIN V16 [get_ports {adc_dat_a_i[13]}]

set_property IOSTANDARD LVCMOS18 [get_ports {adc_dat_b_i[*]}]
set_property IOB TRUE [get_ports {adc_dat_b_i[*]}]

set_property PACKAGE_PIN R18 [get_ports {adc_dat_b_i[0]}]
set_property PACKAGE_PIN P16 [get_ports {adc_dat_b_i[1]}]
set_property PACKAGE_PIN P18 [get_ports {adc_dat_b_i[2]}]
set_property PACKAGE_PIN N17 [get_ports {adc_dat_b_i[3]}]
set_property PACKAGE_PIN R19 [get_ports {adc_dat_b_i[4]}]
set_property PACKAGE_PIN T20 [get_ports {adc_dat_b_i[5]}]
set_property PACKAGE_PIN T19 [get_ports {adc_dat_b_i[6]}]
set_property PACKAGE_PIN U20 [get_ports {adc_dat_b_i[7]}]
set_property PACKAGE_PIN V20 [get_ports {adc_dat_b_i[8]}]
set_property PACKAGE_PIN W20 [get_ports {adc_dat_b_i[9]}]
set_property PACKAGE_PIN Y18 [get_ports {adc_dat_b_i[10]}]
set_property PACKAGE_PIN Y19 [get_ports {adc_dat_b_i[11]}]
set_property PACKAGE_PIN W18 [get_ports {adc_dat_b_i[12]}]
set_property PACKAGE_PIN W19 [get_ports {adc_dat_b_i[13]}]

set_property IOSTANDARD LVCMOS33 [get_ports {dac_dat_a_o[*]}]
set_property SLEW FAST [get_ports {dac_dat_a_o[*]}]
set_property DRIVE 8 [get_ports {dac_dat_a_o[*]}]
set_property IOB TRUE [get_ports {dac_dat_a_o[*]}]

set_property PACKAGE_PIN M19 [get_ports {dac_dat_a_o[0]}]
set_property PACKAGE_PIN M20 [get_ports {dac_dat_a_o[1]}]
set_property PACKAGE_PIN L19 [get_ports {dac_dat_a_o[2]}]
set_property PACKAGE_PIN L20 [get_ports {dac_dat_a_o[3]}]
set_property PACKAGE_PIN K19 [get_ports {dac_dat_a_o[4]}]
set_property PACKAGE_PIN J19 [get_ports {dac_dat_a_o[5]}]
set_property PACKAGE_PIN J20 [get_ports {dac_dat_a_o[6]}]
set_property PACKAGE_PIN H20 [get_ports {dac_dat_a_o[7]}]
set_property PACKAGE_PIN G19 [get_ports {dac_dat_a_o[8]}]
set_property PACKAGE_PIN G20 [get_ports {dac_dat_a_o[9]}]
set_property PACKAGE_PIN F19 [get_ports {dac_dat_a_o[10]}]
set_property PACKAGE_PIN F20 [get_ports {dac_dat_a_o[11]}]
set_property PACKAGE_PIN D20 [get_ports {dac_dat_a_o[12]}]
set_property PACKAGE_PIN D19 [get_ports {dac_dat_a_o[13]}]

set_property IOSTANDARD LVCMOS33 [get_ports dac_*_o]
set_property SLEW FAST [get_ports dac_*_o]
set_property DRIVE 8 [get_ports dac_*_o]

set_property PACKAGE_PIN M17 [get_ports dac_wrt_o]
set_property PACKAGE_PIN M18 [get_ports dac_clk_o]
set_property PACKAGE_PIN N15 [get_ports dac_sel_o]
set_property PACKAGE_PIN N16 [get_ports dac_rst_o]

# Dummy Pins for DAC B (Falls im Design nicht verbunden, aber Core erfordert Pins)
set_property IOSTANDARD LVCMOS33 [get_ports {dac_dat_b_o[*]}]
set_property SLEW FAST [get_ports {dac_dat_b_o[*]}]
set_property DRIVE 8 [get_ports {dac_dat_b_o[*]}]

# Hinweis: Wir mappen DAC B auf dieselben Pins wie DAC A, falls er nicht genutzt wird,
# oder auf ungenutzte Pins, um Bitstream-Fehler zu vermeiden.
# Sauberer ist es, DAC B im Block Design auf "nicht verbunden" zu setzen, 
# aber der red_pitaya_adc_dac Core exportiert sie oft. 
# Hier mappen wir DAC B der Einfachheit halber auf Erweiterungs-Pins oder lassen sie weg, 
# wenn Bitgen meckert. Für jetzt lassen wir DAC B Pins unconstrained, 
# da sie im Tcl script vorhanden sind. Falls Bitgen fehlschlägt, fügen Sie Pins hinzu.

set_property IOSTANDARD LVCMOS33 [get_ports {led_o[*]}]
set_property SLEW SLOW [get_ports {led_o[*]}]
set_property DRIVE 4 [get_ports {led_o[*]}]

set_property PACKAGE_PIN F16 [get_ports {led_o[0]}]
set_property PACKAGE_PIN F17 [get_ports {led_o[1]}]
set_property PACKAGE_PIN G15 [get_ports {led_o[2]}]
set_property PACKAGE_PIN H15 [get_ports {led_o[3]}]
set_property PACKAGE_PIN K14 [get_ports {led_o[4]}]
set_property PACKAGE_PIN G14 [get_ports {led_o[5]}]
set_property PACKAGE_PIN J15 [get_ports {led_o[6]}]
set_property PACKAGE_PIN J14 [get_ports {led_o[7]}]