`timescale 1 ns / 1 ps

// Simple counter for BRAM addressing
//
// Write enable is set to 1 for one cycle
// after a rising edge is detected on the trigger

module address_counter #
(
  parameter integer COUNT_WIDTH = 13
)
(
  input  wire clken, // Clock enable
  input  wire trig, // Trigger
  input  wire clk,
  output wire [31:0] address,
  output wire [3:0] wen, // Write enable
  input  wire [COUNT_WIDTH-1:0] count_max
);

  reg trig_reg;
  reg capture_active;
  reg wen_reg;
  reg [COUNT_WIDTH-1:0] count;

  initial count = 0;
  initial trig_reg = 0;
  initial capture_active = 0;
  initial wen_reg = 0;

  always @(posedge clk) begin
    trig_reg <= trig;

    if (clken) begin
      // Start capture on trigger edge
      if (trig ^ trig_reg) begin
        capture_active <= 1;
        count <= 0;
      end else if (capture_active) begin
        if (count == count_max) begin
          capture_active <= 0;
          count <= 0;
        end else begin
          count <= count + 1;
        end
      end

      // Write-enable is active during the whole capture window.
      wen_reg <= capture_active || (trig ^ trig_reg);
    end else begin
      capture_active <= 0;
      wen_reg <= 0;
      count <= 0;
    end
  end

  assign address = count << 2;
  assign wen = {4{wen_reg}};

endmodule
