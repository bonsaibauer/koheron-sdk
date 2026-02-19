/// ADC DAC BRAM driver
///
/// (c) Koheron

#ifndef __DRIVERS_ADC_DAC_BRAM_HPP__
#define __DRIVERS_ADC_DAC_BRAM_HPP__

#include <context.hpp>
#include <array>
#include <cmath>
#include <string>
#include <sstream>

constexpr uint32_t dac_size = mem::dac_range/sizeof(uint32_t);
constexpr uint32_t adc_size = mem::adc_range/sizeof(uint32_t);

class AdcDacBram
{


  public:
    AdcDacBram(Context& ctx_)
    : ctx(ctx_)
    , ctl(ctx.mm.get<mem::control>())
    , sts(ctx.mm.get<mem::status>())
    , adc_map(ctx.mm.get<mem::adc>())
    , dac_map(ctx.mm.get<mem::dac>())
    {

        set_dac_function(0,10000.0);
    }
    
    void trigger_acquisition() {
        ctl.set_bit<reg::trig, 0>();
        ctl.clear_bit<reg::trig, 0>();
    }

    uint32_t get_dac_size() {
        return dac_size;
    }

    uint32_t get_adc_size() {
        return adc_size;
    }

    void set_dac_function(uint32_t function,double f) {
    	std::array<uint32_t, dac_size> data;
        double T=1/f;
        double Tmax=(dac_size-1)/fs;
        current_function=function;
        current_frequency=f;

        uint32_t len=static_cast<uint32_t>(std::floor(Tmax/T)*fs/f);
        current_waveform_len=len;
        
        ctl.write<reg::trig>(((len-1)<<1)+(1&ctl.read<reg::trig>()));

        double temp_integral;
	
        if(function==0){
            for (uint32_t i=0;i<data.size();i++) {
                double valt=modf((f*i/fs),&temp_integral);
                int32_t val2=static_cast<int32_t>( (2*valt-1    )*dac_resolution/2.1);	
                uint32_t val=(val2 % (dac_resolution-1));
                data[i]=(val+(val<<16));
            }
        } else {
            for (uint32_t i=0;i<data.size();i++) {
                double valt=modf((f*i/fs),&temp_integral);
                int32_t val2=static_cast<int32_t>((2*fabs( 2*valt-1)-1)*dac_resolution/2.1);
                
                uint32_t val=(val2 % (dac_resolution-1));
                data[i]=(val+(val<<16));
            }
        }
    	dac_map.write_array(data);
    
    }

    void set_dac_data(const std::array<uint32_t, dac_size>& data) {
        dac_map.write_array(data);
    }

    std::array<uint32_t, adc_size> get_adc() {
        trigger_acquisition();
        return adc_map.read_array<uint32_t, adc_size>();
    }
    
    
   // Read channel and take one point every decim_factor points
    std::vector<float>& get_decimated_data(uint32_t channel) {
    	std::array<uint32_t, adc_size> arr=get_adc();
    	
    	decimated_data.resize(0);
    	
       	if(channel==0) 
		for (uint32_t value : arr) {
			decimated_data.push_back(static_cast<float>((((static_cast<int32_t>(value % 16384) - 8192) & 0x3FFF)-8192) )/819.2f);
	    	}    	
	else
		for (uint32_t value : arr) {
			decimated_data.push_back(static_cast<float>((((static_cast<int32_t>((value>>16) % 16384) - 8192) & 0x3FFF)-8192) )/819.2f);
	    	}    	
	
        return decimated_data;
    }
    
    std::string get_config_as_text() const {
        double f=current_frequency;
        double T=1/f;
        double Tmax=(dac_size-1)/fs;

        std::ostringstream oss;
        const char* function_name = (current_function == 0) ? "Sinus (0)" : "Rampe (1)";

        oss << "--- Aktuelle DAC-Konfiguration ---\n";
        oss << "  Funktion: " << function_name << "\n";
        oss << "  Gesamte Speicherlänge: " << Tmax*1000<< "ms ("<< dac_size <<" Sampes) \n";
        oss << "  Min Frequenz: " << 1/(Tmax*1000)<< "kHz \n";
        oss << "  Perioden: " << std::floor(Tmax/T) << "\n";
        oss << "  Datenpunkte: " << std::floor(Tmax/T)*fs/f << "\n";
        oss << "  Aktuelle Frequenz: " << current_frequency/1000 << " kHz\n";
        oss << "  Wellenform-Länge (len): " << current_waveform_len << " Samples";
        return oss.str();
    }

    uint32_t getlen() {
        return current_waveform_len;
    }
    


 private:
    Context& ctx;
    Memory<mem::control>& ctl;
    Memory<mem::status>& sts;
    Memory<mem::adc>& adc_map;
    Memory<mem::dac>& dac_map;
    std::vector<float> decimated_data;
    uint32_t current_function;
    double current_frequency;
    uint32_t current_waveform_len;
    const double fs=125000000;
    const uint32_t dac_resolution=1<<14;

}; // class AdcDacBram

#endif // __DRIVERS_ADC_DAC_BRAM_HPP__
