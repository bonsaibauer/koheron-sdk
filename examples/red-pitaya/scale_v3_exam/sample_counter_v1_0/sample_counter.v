`timescale 1 ns / 1 ps

// ----------------------------
// Module: Sample Counter
// ----------------------------
// Sample memory address generator with phase-stable capture:
// - `address` (DAC) runs continuously (replay loop)
// - `address_adc` (ADC) runs only while capture is active
// - `trig` only arms capture; start is aligned to next DAC wrap

module sample_counter #
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

  // ----------------------------
  // Module: Counter Runtime
  // ----------------------------
  always @(posedge clk) begin
    trig_reg <= trig;

    if (clken) begin
      // DAC replay address.
      if (dac_count == count_max) begin
        dac_count <= 0;
      end else begin
        dac_count <= dac_count + 1;
      end

      // Trigger arm and aligned capture start.
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

      // ADC write-enable during capture only.
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

  // ----------------------------
  // Module: Outputs
  // ----------------------------
  assign address = dac_count << 2;
  assign address_adc = adc_count << 2;
  assign wen = {4{wen_reg}};

endmodule
