module axis_packetizer #(
    parameter integer TDATA_WIDTH = 64,
    parameter integer PKT_LENGTH  = 32768   // beats per packet (1 descriptor)
)(
    input                            aclk,
    input                            aresetn,

    input                            trig,
    input [31:0]                     pkt_count,

    input                            s_axis_tvalid,
    output                           s_axis_tready,
    input [TDATA_WIDTH-1:0]          s_axis_tdata,

    output                           m_axis_tvalid,
    input                            m_axis_tready,
    output                           m_axis_tlast,
    output [TDATA_WIDTH-1:0]         m_axis_tdata,
    output [(TDATA_WIDTH+7)/8-1:0]   m_axis_tkeep
);

    // trigger edge
    reg trig_d;
    wire trig_rise = trig & ~trig_d;

    always @(posedge aclk)
        if (!aresetn) trig_d <= 1'b0;
        else          trig_d <= trig;

    // active flag
    reg packet_active = 1'b0;

    wire beat_xfer = s_axis_tvalid & s_axis_tready;

    // beat counter
    reg [$clog2(PKT_LENGTH):0] beat_cnt;

    // packet counter
    reg [31:0] pkt_cnt;

    wire last_beat   = (beat_cnt == PKT_LENGTH-1);
    wire last_packet = (pkt_cnt  == pkt_count-1);

    always @(posedge aclk) begin
        if (!aresetn) begin
            packet_active <= 1'b0;
            beat_cnt      <= 0;
            pkt_cnt       <= 0;
        end else if (trig_rise) begin
            packet_active <= 1'b1;
            beat_cnt      <= 0;
            pkt_cnt       <= 0;
        end else if (packet_active && beat_xfer) begin
            if (last_beat) begin
                beat_cnt <= 0;
                if (last_packet)
                    packet_active <= 1'b0;   // done
                else
                    pkt_cnt <= pkt_cnt + 1;
            end else begin
                beat_cnt <= beat_cnt + 1;
            end
        end
    end

    assign s_axis_tready = packet_active ? m_axis_tready : 1'b0;
    assign m_axis_tvalid = packet_active ? s_axis_tvalid : 1'b0;
    assign m_axis_tdata  = s_axis_tdata;

    assign m_axis_tlast  = packet_active && last_beat;

    localparam TKEEP_WIDTH = (TDATA_WIDTH+7)/8;
    assign m_axis_tkeep = {TKEEP_WIDTH{1'b1}};

endmodule
