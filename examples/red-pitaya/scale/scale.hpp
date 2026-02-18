#ifndef __DRIVERS_SCALE_HPP__
#define __DRIVERS_SCALE_HPP__

#include <context.hpp>
#include <cmath>

constexpr double SYSTEM_CLOCK = 125000000.0; // 125 MHz

class ScaleDriver
{
  public:
    ScaleDriver(Context& ctx)
    : ctl(ctx.mm.get<mem::control>())
    , sts(ctx.mm.get<mem::status>())
    {}

    void set_frequency(double frequency_hz) {
        // Begrenzung, um Aliasing zu vermeiden (Nyquist: max 62.5 MHz)
        if (frequency_hz > SYSTEM_CLOCK / 2.0) {
            frequency_hz = SYSTEM_CLOCK / 2.0;
        }
        
        uint32_t phase_inc = (uint32_t)((frequency_hz / SYSTEM_CLOCK) * 4294967296.0); //32-Bit

        ctl.write<reg::dds_freq_hz>(phase_inc);
    }

    uint32_t get_adc_data() {
        return sts.read<reg::adc_amplitude>();
    }

    void set_leds(uint32_t value) {
        ctl.write<reg::led>(value);
    }

  private:
    Memory<mem::control>& ctl;
    Memory<mem::status>& sts;
};

#endif