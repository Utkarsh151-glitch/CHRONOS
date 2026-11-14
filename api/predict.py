from http.server import BaseHTTPRequestHandler
import json
import math
import os

# Load weights
CURR_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(CURR_DIR, "model_weights.json")

with open(WEIGHTS_PATH, "r", encoding="utf-8") as f:
    MODEL_DATA = json.load(f)

H = MODEL_DATA["hidden_size"]
W_ih = MODEL_DATA["weights"]["lstm.weight_ih_l0"]
W_hh = MODEL_DATA["weights"]["lstm.weight_hh_l0"]
b_ih = MODEL_DATA["weights"]["lstm.bias_ih_l0"]
b_hh = MODEL_DATA["weights"]["lstm.bias_hh_l0"]
b = [b_ih[i] + b_hh[i] for i in range(len(b_ih))]
W_out = MODEL_DATA["weights"]["head.weight"][0]
b_out = MODEL_DATA["weights"]["head.bias"][0]

MEAN = 618.6301
STD = 105.4375

def sigmoid(x):
    if x < -500: return 0.0
    if x > 500: return 1.0
    return 1.0 / (1.0 + math.exp(-x))

def run_forward(seq, return_gates=False):
    h = [0.0] * H
    c = [0.0] * H
    gates = {"i": [], "f": [], "g": [], "o": [], "c": [], "h": []} if return_gates else None

    for x_t in seq:
        z = [0.0] * (4 * H)
        for row in range(4 * H):
            val = b[row] + W_ih[row][0] * x_t
            hh_row = W_hh[row]
            for col in range(H):
                val += hh_row[col] * h[col]
            z[row] = val

        c_next = [0.0] * H
        h_next = [0.0] * H
        i_step, f_step, g_step, o_step = [], [], [], []

        for k in range(H):
            i_g = sigmoid(z[k])
            f_g = sigmoid(z[H + k])
            g_g = math.tanh(z[2 * H + k])
            o_g = sigmoid(z[3 * H + k])

            c_val = f_g * c[k] + i_g * g_g
            h_val = o_g * math.tanh(c_val)

            c_next[k] = c_val
            h_next[k] = h_val

            if return_gates:
                i_step.append(i_g)
                f_step.append(f_g)
                g_step.append(g_g)
                o_step.append(o_g)

        if return_gates:
            gates["i"].append(i_step)
            gates["f"].append(f_step)
            gates["g"].append(g_step)
            gates["o"].append(o_step)
            gates["c"].append(list(c_next))
            gates["h"].append(list(h_next))

        h = h_next
        c = c_next

    pred_norm = b_out
    for k in range(H):
        pred_norm += W_out[k] * h[k]

    pred_mw = pred_norm * STD + MEAN
    return pred_norm, pred_mw, gates

class handler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        sample_mw = [580, 560, 540, 530, 535, 560, 610, 680, 720, 740, 735, 730, 725, 715, 710, 720, 750, 780, 770, 740, 700, 660, 620, 590]
        sample_norm = [(v - MEAN) / STD for v in sample_mw]
        pred_norm, pred_mw, _ = run_forward(sample_norm, False)

        resp = {
            "model": "CHRONOS LSTM(1->32) + Linear(32->1)",
            "runtime": "Python BaseHTTPRequestHandler (Vercel Serverless)",
            "sample_prediction_mw": round(pred_mw, 2),
            "normalized_forecast": round(pred_norm, 6),
            "parameters": 4513
        }
        self.send_response(200)
        self._send_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(resp).encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        try:
            body = json.loads(post_data.decode("utf-8"))
        except Exception as e:
            self.send_response(400)
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode("utf-8"))
            return

        seq = body.get("sequence", [])
        if not seq:
            self.send_response(400)
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "sequence array required"}).encode("utf-8"))
            return

        is_norm = body.get("is_normalized", False)
        return_gates = body.get("return_gates", False)
        norm_seq = [float(v) for v in seq] if is_norm else [(float(v) - MEAN) / STD for v in seq]

        pred_norm, pred_mw, gates = run_forward(norm_seq, return_gates)

        resp = {
            "success": True,
            "predicted_demand_mw": round(pred_mw, 2),
            "normalized_prediction": round(pred_norm, 6),
            "gates": gates
        }
        self.send_response(200)
        self._send_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(resp).encode("utf-8"))
