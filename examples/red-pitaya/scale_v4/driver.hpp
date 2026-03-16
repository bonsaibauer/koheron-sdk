/// ADC DAC BRAM driver
///
/// (c) Koheron

#ifndef __DRIVERS_ADC_DAC_BRAM_HPP__
#define __DRIVERS_ADC_DAC_BRAM_HPP__

#include <context.hpp>
#include <array>
#include <algorithm>
#include <cmath>
#include <tuple>
#include <vector>

constexpr uint32_t dac_size = mem::dac_range / sizeof(uint32_t);
constexpr uint32_t adc_size = mem::adc_range / sizeof(uint32_t);

class AdcDacBram {
  public:
    // ----------------------------
    // Module: Initialization
    // ----------------------------
    AdcDacBram(Context& ctx_)
    : ctx(ctx_)
    , ctl(ctx.mm.get<mem::control>())
    , adc_map(ctx.mm.get<mem::adc>())
    , dac_map(ctx.mm.get<mem::dac>())
    {
        // Keep both outputs active by default.
        current_output_channel = 2;
        current_amplitude_vpk = 0.5;
        set_dac_function(1, 100000.0);
    }

    // ----------------------------
    // Module: Acquisition Trigger + Buffer Sizes
    // ----------------------------
    void trigger_acquisition() {
        // Toggle trigger bit to generate a deterministic edge for the FPGA counter.
        ctl.write<reg::trig>(ctl.read<reg::trig>() ^ 0x1);
    }

    uint32_t get_adc_size() {
        return adc_size;
    }

    // ----------------------------
    // Module: DAC Configuration
    // ----------------------------
    void set_dac_function(uint32_t function, double f) {
        // Sine only in scale_v4: function selector is intentionally ignored.
        (void)function;
        const double f_cmd = std::max(1.0, std::min(f, max_output_frequency_hz));

        // Build a strictly periodic LUT over the actually replayed BRAM span.
        // This removes boundary glitches from non-periodic table wrap.
        const double cycles_full = f_cmd * static_cast<double>(dac_size) / fs;
        uint32_t periods = static_cast<uint32_t>(std::llround(cycles_full));
        periods = std::max(uint32_t(1), periods);

        uint32_t len = static_cast<uint32_t>(std::llround(static_cast<double>(periods) * fs / f_cmd));
        len = std::max(uint32_t(2), std::min(len, dac_size));

        current_waveform_len = len;
        current_waveform_periods = periods;
        current_frequency = static_cast<double>(periods) * fs / static_cast<double>(len);

        ctl.write<reg::trig>(((len - 1) << 1) + (1 & ctl.read<reg::trig>()));

        update_dac_waveform();
    }

    void set_output_channel(uint32_t channel) {
        current_output_channel = std::min(channel, uint32_t(2));
        update_dac_waveform();
    }

    void set_dac_amplitude(double amplitude_vpk) {
        current_amplitude_vpk = std::max(0.0, std::min(amplitude_vpk, max_output_amplitude_vpk));
        update_dac_waveform();
    }

    void set_plot_decimation(uint32_t mode, uint32_t max_points) {
        decimation_mode = std::min(mode, uint32_t(3));
        const uint32_t max_supported = std::max(dac_size, adc_size);
        decimation_max_points = std::max(uint32_t(1), std::min(max_points, max_supported));
    }

    uint32_t get_adc_decimation_step() const {
        return compute_decimation_step(adc_size);
    }

    uint32_t get_dac_decimation_step() const {
        return compute_decimation_step(dac_size);
    }

    // ----------------------------
    // Module: ADC Acquisition Endpoints
    // ----------------------------
    std::array<uint32_t, adc_size> get_adc() {
        trigger_acquisition();
        return adc_map.read_array<uint32_t, adc_size>();
    }

    // Returns interleaved [IN1_V0, IN2_V0, IN1_V1, IN2_V1, ...] from one acquisition.
    std::vector<float>& get_adc_dual_data() {
        const auto arr = get_adc();
        adc_dual_data.clear();
        adc_dual_data.reserve(2 * adc_size);

        for (uint32_t i = 0; i < adc_size; i++) {
            adc_dual_data.push_back(adc_sample_to_volts(arr[i], 0));
            adc_dual_data.push_back(adc_sample_to_volts(arr[i], 1));
        }

        return adc_dual_data;
    }

    // Dedicated RMS endpoint in the driver (independent from the UI processing pipeline).
    // Returns RMS for IN1 and IN2 in raw ADC counts (14-bit signed domain).
    std::tuple<float, float> get_adc_rms_data(uint32_t n_samples) {
        auto arr = get_adc();
        const uint32_t count = std::max(uint32_t(1), std::min(n_samples, adc_size));

        double acc0 = 0.0;
        double acc1 = 0.0;

        for (uint32_t i = 0; i < count; i++) {
            const uint32_t value = arr[i];
            const int32_t s0 = ((static_cast<int32_t>(value % 16384) - 8192) & 0x3FFF) - 8192;
            const int32_t s1 = ((static_cast<int32_t>((value >> 16) % 16384) - 8192) & 0x3FFF) - 8192;

            acc0 += static_cast<double>(s0) * static_cast<double>(s0);
            acc1 += static_cast<double>(s1) * static_cast<double>(s1);
        }

        const float rms0 = static_cast<float>(std::sqrt(acc0 / static_cast<double>(count)));
        const float rms1 = static_cast<float>(std::sqrt(acc1 / static_cast<double>(count)));
        return std::make_tuple(rms0, rms1);
    }

    // True RMS with balanced sampling around zero crossing.
    // Uses up to 4000 samples >= 0 and 4000 samples < 0 based on IN1 sign.
    // Returns RMS(IN1), RMS(IN2), N_pos, N_neg.
    std::tuple<float, float, uint32_t, uint32_t> get_adc_true_rms_data() {
        auto arr = get_adc();
        constexpr uint32_t target_per_side = 4000;

        double acc0 = 0.0;
        double acc1 = 0.0;
        uint32_t n_pos = 0;
        uint32_t n_neg = 0;

        for (uint32_t i = 0; i < adc_size; i++) {
            const uint32_t value = arr[i];
            const int32_t s0 = ((static_cast<int32_t>(value % 16384) - 8192) & 0x3FFF) - 8192;
            const int32_t s1 = ((static_cast<int32_t>((value >> 16) % 16384) - 8192) & 0x3FFF) - 8192;

            if (s0 >= 0 && n_pos < target_per_side) {
                acc0 += static_cast<double>(s0) * static_cast<double>(s0);
                acc1 += static_cast<double>(s1) * static_cast<double>(s1);
                n_pos++;
            } else if (s0 < 0 && n_neg < target_per_side) {
                acc0 += static_cast<double>(s0) * static_cast<double>(s0);
                acc1 += static_cast<double>(s1) * static_cast<double>(s1);
                n_neg++;
            }

            if (n_pos >= target_per_side && n_neg >= target_per_side) {
                break;
            }
        }

        const uint32_t count = std::max(uint32_t(1), n_pos + n_neg);
        const float rms0 = static_cast<float>(std::sqrt(acc0 / static_cast<double>(count)));
        const float rms1 = static_cast<float>(std::sqrt(acc1 / static_cast<double>(count)));
        return std::make_tuple(rms0, rms1, n_pos, n_neg);
    }

    // ----------------------------
    // Module: Decimated Data Endpoints (index-exact XY)
    // ----------------------------
    std::vector<float>& get_decimated_dac_data_xy(uint32_t channel) {
        const auto arr = dac_map.read_array<uint32_t, dac_size>();
        const uint32_t safe_channel = std::min(channel, uint32_t(1));

        const auto sample_at = [&](uint32_t index) -> float {
            return dac_sample_to_volts(arr[index], safe_channel);
        };

        return build_decimated_xy(arr.size(), sample_at, decimated_dac_data_xy);
    }

  private:
    // ----------------------------
    // State: MMIO Handles + Runtime Buffers
    // ----------------------------
    Context& ctx;
    Memory<mem::control>& ctl;
    Memory<mem::adc>& adc_map;
    Memory<mem::dac>& dac_map;
    std::vector<float> decimated_dac_data_xy;
    std::vector<float> adc_dual_data;
    double current_frequency = 100000.0;
    uint32_t current_waveform_len = dac_size;
    uint32_t current_waveform_periods = 1;
    uint32_t current_output_channel = 0;
    double current_amplitude_vpk = 0.5;
    uint32_t decimation_mode = 1; // 0=Off, 1=Stride, 2=MinMax, 3=Mean
    uint32_t decimation_max_points = 2048;
    const double fs = 125000000;
    const double max_output_frequency_hz = 10000000.0;
    const double max_output_amplitude_vpk = 1.0; // 2.0 Vpp
    const uint32_t dac_resolution = 1 << 14;

    uint32_t compute_decimation_step(uint32_t raw_length) const {
        const uint32_t n = std::max(uint32_t(1), raw_length);
        if (decimation_mode == 0) {
            return 1;
        }
        const uint32_t max_points = std::max(uint32_t(1), decimation_max_points);
        const uint32_t target_points = (decimation_mode == 2)
            ? std::max(uint32_t(1), max_points / 2)
            : max_points;
        return std::max(uint32_t(1), (n + target_points - 1) / target_points);
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

    float dac_sample_to_volts(uint32_t packed_sample, uint32_t channel) const {
        const uint32_t raw14 = (channel == 0)
            ? (packed_sample & 0x3FFF)
            : ((packed_sample >> 16) & 0x3FFF);
        // Keep DAC diagnostics consistent with synthesis scaling.
        const double dac_full_scale_counts = static_cast<double>(dac_resolution) / 2.1;
        const double volts = static_cast<double>(decode_signed14(raw14)) *
            (max_output_amplitude_vpk / dac_full_scale_counts);
        return static_cast<float>(volts);
    }

    template<typename SampleAt>
    std::vector<float>& build_decimated_xy(uint32_t raw_size, const SampleAt& sample_at, std::vector<float>& out_xy) {
        out_xy.clear();
        if (raw_size == 0) {
            return out_xy;
        }

        const uint32_t step = compute_decimation_step(raw_size);
        const uint32_t buckets = (raw_size + step - 1) / step;

        if (decimation_mode == 0) {
            out_xy.reserve(2 * raw_size);
        } else if (decimation_mode == 2) {
            out_xy.reserve(4 * buckets);
        } else {
            out_xy.reserve(2 * buckets);
        }

        const auto push_xy = [&](float x, float y) {
            out_xy.push_back(x);
            out_xy.push_back(y);
        };

        if (decimation_mode == 0 || decimation_mode == 1) {
            const uint32_t loop_step = (decimation_mode == 0) ? 1 : step;
            for (uint32_t i = 0; i < raw_size; i += loop_step) {
                push_xy(static_cast<float>(i), sample_at(i));
            }
            return out_xy;
        }

        for (uint32_t start = 0; start < raw_size; start += step) {
            const uint32_t end = std::min(raw_size, start + step);

            if (decimation_mode == 3) {
                double sum = 0.0;
                for (uint32_t i = start; i < end; i++) {
                    sum += static_cast<double>(sample_at(i));
                }
                const float mean = static_cast<float>(sum / static_cast<double>(std::max(uint32_t(1), end - start)));
                push_xy(static_cast<float>(start), mean);
                continue;
            }

            float min_v = sample_at(start);
            float max_v = min_v;
            uint32_t min_i = start;
            uint32_t max_i = start;

            for (uint32_t i = start + 1; i < end; i++) {
                const float value = sample_at(i);
                if (value < min_v) {
                    min_v = value;
                    min_i = i;
                }
                if (value > max_v) {
                    max_v = value;
                    max_i = i;
                }
            }

            if (min_i == max_i) {
                push_xy(static_cast<float>(min_i), min_v);
            } else if (min_i < max_i) {
                push_xy(static_cast<float>(min_i), min_v);
                push_xy(static_cast<float>(max_i), max_v);
            } else {
                push_xy(static_cast<float>(max_i), max_v);
                push_xy(static_cast<float>(min_i), min_v);
            }
        }

        return out_xy;
    }

    // ----------------------------
    // Module: DAC Waveform Synthesis Helpers
    // ----------------------------
    int32_t build_wave_sample(double phase) const {
        constexpr double pi = 3.14159265358979323846;
        const double normalized = std::sin(2.0 * pi * phase);

        const double full_scale = static_cast<double>(dac_resolution) / 2.1;
        const double amplitude_scale = current_amplitude_vpk / max_output_amplitude_vpk;
        return static_cast<int32_t>(std::llround(normalized * full_scale * amplitude_scale));
    }

    // ----------------------------
    // Module: DAC Memory Writer
    // ----------------------------
    void update_dac_waveform() {
        std::array<uint32_t, dac_size> data;

        for (uint32_t i = 0; i < data.size(); i++) {
            const double phase = std::fmod(
                static_cast<double>(current_waveform_periods) * static_cast<double>(i) /
                static_cast<double>(std::max(uint32_t(1), current_waveform_len)),
                1.0
            );
            const int32_t sample14s = build_wave_sample(phase);
            const uint32_t encoded = static_cast<uint32_t>(sample14s) & 0x3FFF;

            uint32_t out1 = 0;
            uint32_t out2 = 0;

            if (current_output_channel == 0 || current_output_channel == 2) {
                out1 = encoded;
            }
            if (current_output_channel == 1 || current_output_channel == 2) {
                out2 = encoded;
            }

            data[i] = out1 + (out2 << 16);
        }

        dac_map.write_array(data);
    }

}; // class AdcDacBram

#endif // __DRIVERS_ADC_DAC_BRAM_HPP__
