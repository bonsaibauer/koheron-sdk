/// Scale sine driver

#ifndef __DRIVERS_SCALE_SINE_HPP__
#define __DRIVERS_SCALE_SINE_HPP__

#include <context.hpp>
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

constexpr uint32_t dac_size = mem::dac_range / sizeof(uint32_t);
constexpr uint32_t adc_size = mem::adc_range / sizeof(uint32_t);

class ScaleSine {
  public:
    // ----------------------------
    // Module: Initialization
    // ----------------------------
    // Driver configuration:
    // - DAC waveform: sine, 100 kHz, 0.5 Vpk, OUT1 + OUT2
    // - DAC plot limit: 2048 points
    // - LEDs reset to 0
    explicit ScaleSine(Context& ctx_)
    : ctl(ctx.mm.get<mem::control>())
    , adc_map(ctx.mm.get<mem::adc>())
    , dac_map(ctx.mm.get<mem::dac>())
    {
        initialize_dac_waveform();
        set_leds(0);
    }

    // ----------------------------
    // Module: Control Endpoint
    // ----------------------------
    void set_leds(uint32_t led_value) {
        ctl.write<reg::led>(led_value);
    }

    // ----------------------------
    // Module: Read Endpoints
    // ----------------------------
    std::vector<float>& get_adc_dual_data() {
        trigger_acquisition();
        const auto arr = adc_map.read_array<uint32_t, adc_size>();

        adc_dual_data.clear();
        adc_dual_data.reserve(2 * adc_size);

        for (uint32_t i = 0; i < adc_size; i++) {
            adc_dual_data.push_back(adc_sample_to_volts(arr[i], 0));
            adc_dual_data.push_back(adc_sample_to_volts(arr[i], 1));
        }

        return adc_dual_data;
    }

    std::vector<float>& get_decimated_dac_data_xy() {
        const auto arr = dac_map.read_array<uint32_t, dac_size>();

        decimated_dac_xy.clear();
        decimated_dac_xy.reserve(2 * ((dac_size + dac_decimation_step - 1) / dac_decimation_step));

        for (uint32_t i = 0; i < dac_size; i += dac_decimation_step) {
            decimated_dac_xy.push_back(static_cast<float>(i));
            decimated_dac_xy.push_back(dac_sample_to_volts(arr[i]));
        }

        return decimated_dac_xy;
    }

  private:
    // ----------------------------
    // Module: Runtime State
    // ----------------------------
    Memory<mem::control>& ctl;
    Memory<mem::adc>& adc_map;
    Memory<mem::dac>& dac_map;

    std::vector<float> adc_dual_data;
    std::vector<float> decimated_dac_xy;

    uint32_t waveform_len = dac_size;
    uint32_t waveform_periods = 1;

    const uint32_t dac_decimation_step = (dac_size + 2047) / 2048;
    const double fs = 125000000.0;
    const uint32_t dac_resolution = 1 << 14;

    const double configured_frequency_hz = 100000.0;
    const double configured_amplitude_vpk = 0.5;
    const double dac_full_scale_vpk = 1.0;

    // ----------------------------
    // Module: Internal Helpers
    // ----------------------------
    void trigger_acquisition() {
        ctl.write<reg::trig>(ctl.read<reg::trig>() ^ 0x1);
    }

    void initialize_dac_waveform() {
        const double cycles_full = configured_frequency_hz * static_cast<double>(dac_size) / fs;
        uint32_t periods = static_cast<uint32_t>(std::llround(cycles_full));
        periods = std::max(uint32_t(1), periods);

        uint32_t len = static_cast<uint32_t>(
            std::llround(static_cast<double>(periods) * fs / configured_frequency_hz)
        );
        len = std::max(uint32_t(2), std::min(len, dac_size));

        waveform_len = len;
        waveform_periods = periods;

        ctl.write<reg::trig>(((len - 1) << 1) + (ctl.read<reg::trig>() & 1));
        update_dac_waveform();
    }

    int32_t decode_signed14(uint32_t raw14) const {
        int32_t s = static_cast<int32_t>(raw14 & 0x3FFF);
        if ((s & 0x2000) != 0) {
            s -= 0x4000;
        }
        return s;
    }

    float adc_sample_to_volts(uint32_t packed_sample, uint32_t channel) const {
        const uint32_t raw14 = (channel == 0)
            ? (packed_sample & 0x3FFF)
            : ((packed_sample >> 16) & 0x3FFF);

        return static_cast<float>(decode_signed14(raw14)) / 819.2f;
    }

    float dac_sample_to_volts(uint32_t packed_sample) const {
        const uint32_t raw14 = packed_sample & 0x3FFF;

        const double full_scale_counts = static_cast<double>(dac_resolution) / 2.1;
        const double volts = static_cast<double>(decode_signed14(raw14)) *
            (dac_full_scale_vpk / full_scale_counts);

        return static_cast<float>(volts);
    }

    int32_t build_wave_sample(double phase) const {
        constexpr double pi = 3.14159265358979323846;
        const double normalized = std::sin(2.0 * pi * phase);
        const double full_scale = static_cast<double>(dac_resolution) / 2.1;
        const double amplitude_scale = configured_amplitude_vpk / dac_full_scale_vpk;
        return static_cast<int32_t>(std::llround(normalized * full_scale * amplitude_scale));
    }

    void update_dac_waveform() {
        std::array<uint32_t, dac_size> data;

        for (uint32_t i = 0; i < dac_size; i++) {
            const double phase = std::fmod(
                static_cast<double>(waveform_periods) * static_cast<double>(i) /
                static_cast<double>(std::max(uint32_t(1), waveform_len)),
                1.0
            );

            const int32_t sample14s = build_wave_sample(phase);
            const uint32_t encoded = static_cast<uint32_t>(sample14s) & 0x3FFF;
            data[i] = encoded + (encoded << 16);
        }

        dac_map.write_array(data);
    }
};

#endif // __DRIVERS_SCALE_SINE_HPP__
