`timescale 1 ns / 1 ps

// Counter for BRAM addressing
//
// - `address` (DAC) is free-running (continuous replay)
// - `address_adc` (ADC) runs only during capture
// - trigger arms a capture; capture starts at next DAC wrap for stable frame phase

module address_counter #
(
  parameter integer COUNT_WIDTH = 13
)
(
  input  wire clken, // Clock enable
  input  wire trig, // Trigger
  input  wire clk,
  output wire [31:0] address,
  output wire [31:0] address_adc,
  output wire [3:0] wen, // Write enable
  input  wire [COUNT_WIDTH-1:0] count_max
);

  reg trig_reg;
  reg capture_armed;
  reg capture_active;
  reg wen_reg;
  reg [COUNT_WIDTH-1:0] dac_count;
  reg [COUNT_WIDTH-1:0] adc_count;

  initial dac_count = 0;
  initial adc_count = 0;
  initial trig_reg = 0;
  initial capture_armed = 0;
  initial capture_active = 0;
  initial wen_reg = 0;

  always @(posedge clk) begin
    trig_reg <= trig;

    if (clken) begin
      // Keep DAC address running continuously.
      if (dac_count == count_max) begin
        dac_count <= 0;
      end else begin
        dac_count <= dac_count + 1;
      end

      // Trigger only arms capture. Capture starts on next DAC wrap so
      // ADC frame start stays phase-stable against replay.
      if (trig ^ trig_reg) begin
        capture_armed <= 1;
      end

      if (capture_active) begin
        if (adc_count == count_max) begin
          capture_active <= 0;
          adc_count <= 0;
        end else begin
          adc_count <= adc_count + 1;
        end
      end else if (capture_armed && (dac_count == count_max)) begin
        capture_active <= 1;
        capture_armed <= 0;
        adc_count <= 0;
      end

      // Write-enable is active only during ADC capture.
      if (capture_active || (capture_armed && (dac_count == count_max))) begin
        wen_reg <= 1;
      end else begin
        wen_reg <= 0;
      end
    end else begin
      capture_armed <= 0;
      capture_active <= 0;
      wen_reg <= 0;
      dac_count <= 0;
      adc_count <= 0;
    end
  end

  assign address = dac_count << 2;
  assign address_adc = adc_count << 2;
  assign wen = {4{wen_reg}};

endmodule
