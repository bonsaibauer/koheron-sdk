/// ADC DAC BRAM driver
///
/// (c) Koheron

#ifndef __DRIVERS_ADC_DAC_BRAM_HPP__
#define __DRIVERS_ADC_DAC_BRAM_HPP__

#include <context.hpp>
#include <array>
#include <algorithm>
#include <cmath>
#include <string>
#include <sstream>
#include <tuple>
#include <vector>

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
        constexpr double pi = 3.14159265358979323846;
        const double frequency = std::max(1.0, std::min(f, fs / 2.0));
        double T = 1 / frequency;
        double Tmax = (dac_size - 1) / fs;
        current_function = function;
        current_frequency = frequency;

        uint32_t len = static_cast<uint32_t>(std::floor(Tmax / T) * fs / frequency);
        len = std::max(uint32_t(2), std::min(len, dac_size));
        current_waveform_len = len;

        ctl.write<reg::trig>(((len - 1) << 1) + (1 & ctl.read<reg::trig>()));

        for (uint32_t i = 0; i < data.size(); i++) {
            const double phase = std::fmod(frequency * i / fs, 1.0);
            int32_t val2 = 0;

            if (function == 0) {
                // Original BRAM ramp behaviour
                val2 = static_cast<int32_t>((2 * phase - 1) * dac_resolution / 2.1);
                uint32_t val = static_cast<uint32_t>(val2 % (dac_resolution - 1));
                data[i] = val + (val << 16);
                continue;
            }

            if (function == 1) {
                val2 = static_cast<int32_t>(std::sin(2.0 * pi * phase) * dac_resolution / 2.1);
            } else if (function == 2) {
                val2 = static_cast<int32_t>((2 * phase - 1) * dac_resolution / 2.1);
            } else {
                val2 = static_cast<int32_t>((2 * std::fabs(2 * phase - 1) - 1) * dac_resolution / 2.1);
            }

            uint32_t val = static_cast<uint32_t>(val2) & 0x3FFF;
            data[i] = val + (val << 16);
        }
        dac_map.write_array(data);
    }

    std::vector<uint32_t>& get_adc_snapshot() {
        auto arr = get_adc();
        adc_snapshot.assign(arr.begin(), arr.end());
        return adc_snapshot;
    }

    std::vector<uint32_t>& get_dac_snapshot() {
        auto arr = dac_map.read_array<uint32_t, dac_size>();
        dac_snapshot.assign(arr.begin(), arr.end());
        return dac_snapshot;
    }

    void set_dac_data(const std::array<uint32_t, dac_size>& data) {
        dac_map.write_array(data);
    }

    std::array<uint32_t, adc_size> get_adc() {
        trigger_acquisition();
        return adc_map.read_array<uint32_t, adc_size>();
    }

    std::tuple<int32_t, int32_t> get_adc_raw_data(uint32_t n_avg) {
        auto arr = get_adc();
        const uint32_t count = std::max(uint32_t(1), std::min(n_avg, adc_size));

        int64_t acc0 = 0;
        int64_t acc1 = 0;

        for (uint32_t i = 0; i < count; i++) {
            const uint32_t value = arr[i];
            acc0 += ((static_cast<int32_t>(value % 16384) - 8192) & 0x3FFF) - 8192;
            acc1 += ((static_cast<int32_t>((value >> 16) % 16384) - 8192) & 0x3FFF) - 8192;
        }

        return std::make_tuple(
            static_cast<int32_t>(std::llround(static_cast<double>(acc0) / static_cast<double>(count))),
            static_cast<int32_t>(std::llround(static_cast<double>(acc1) / static_cast<double>(count)))
        );
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
        const char* function_name = "BRAM-Rampe (0)";
        if (current_function == 1) {
            function_name = "Sinus (1)";
        } else if (current_function == 2) {
            function_name = "Saegezahn (2)";
        } else if (current_function == 3) {
            function_name = "Dreieck (3)";
        }

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
    std::vector<uint32_t> adc_snapshot;
    std::vector<uint32_t> dac_snapshot;
    uint32_t current_function;
    double current_frequency;
    uint32_t current_waveform_len;
    const double fs=125000000;
    const uint32_t dac_resolution=1<<14;

}; // class AdcDacBram

#endif // __DRIVERS_ADC_DAC_BRAM_HPP__
