# CHRONOS — 15 Likely Viva Questions (with answers)

**1. What is an RNN, and how does it differ from a feed-forward network?**
An RNN processes a sequence one step at a time and keeps a hidden state hₜ = tanh(W·[hₜ₋₁, xₜ] + b). It uses the same weights at every step. A feed-forward network has no memory between inputs.

**2. Why do plain RNNs struggle with long sequences?**
In backpropagation through time, the gradient reaching step t−k is a product of k Jacobians. If their norms are below 1 the gradient vanishes exponentially, and if above 1 it explodes. Long-range dependencies are therefore hard to learn.

**3. How does an LSTM mitigate the vanishing-gradient problem?**
The cell state is updated additively: cₜ = fₜ⊙cₜ₋₁ + iₜ⊙gₜ. Along this path ∂cₜ/∂cₜ₋₁ contains fₜ directly, so when forget gates stay near 1 the gradient is preserved over many steps. It **reduces** the problem but does not eliminate it. Exploding gradients still need clipping (we clip at norm 1.0).

**4. What does the forget gate do?**
fₜ = σ(W_f[hₜ₋₁, xₜ] + b_f) ∈ (0, 1) for each unit. It decides how much of the previous cell state to keep: 1 keeps everything and 0 erases.

**5. What does the input gate do, and how is it different from the candidate?**
iₜ = σ(·) decides *how much* new information to write. gₜ = tanh(·) ∈ (−1, 1) proposes *what* to write. Their product iₜ⊙gₜ is added to the cell state.

**6. What does the output gate do?**
oₜ = σ(·) selects which parts of the squashed memory are exposed: hₜ = oₜ⊙tanh(cₜ).

**7. What is the difference between the cell state and the hidden state?**
cₜ is the internal long-term memory. It is unbounded and changed only by gated addition. hₜ is the bounded output passed to the next time step and to the prediction layer. It acts as the short-term or working memory.

**8. Why sigmoid for gates and tanh for the candidate?**
Sigmoid gives values in (0, 1) that act as soft switches or percentages. Tanh is zero-centred in (−1, 1), so it can both increase and decrease memory.

**9. What is backpropagation through time (BPTT)?**
The network is unrolled across the 24 time steps into one computational graph with shared weights. Ordinary backprop is applied, and gradients for the shared weights are summed over all time steps. In PyTorch, autograd does this when we call `loss.backward()`.

**10. Which optimizer did you use and why?**
Adam (lr = 3e-3). It keeps per-parameter running averages of the gradient (momentum) and of its square (adaptive scaling). That makes it robust and fast to converge on small recurrent models without much tuning.

**11. Why Mean Squared Error as the loss?**
Forecasting is regression. MSE penalises large errors heavily, is smooth and differentiable, and corresponds to a Gaussian noise assumption. We report MAE and RMSE in MW because they are easier to interpret.

**12. Why split the data chronologically instead of randomly?**
A random split leaks future information into training because neighbouring hours are highly correlated. A chronological split (70% train, 15% validation, 15% test) simulates real deployment: learn from the past, predict the future.

**13. Why normalise with training-set statistics only?**
Using the mean and std of the full series would leak information about the test period. The same training μ and σ are then applied to validation and test data.

**14. How do you know your model is actually good?**
We compare it on the same held-out test windows against (a) the identical untrained network, (b) a persistence baseline (next hour = this hour) and (c) a seasonal-naive baseline (same hour yesterday). The trained LSTM has MAE ≈ 15.2 MW vs 25.7 (persistence), 39.5 (seasonal naive) and 87.8 (untrained). The noise we injected has σ = 12 MW, so an MAE of about 9.6 MW is the floor for any model.

**15. How did you extract and verify the gate activations?**
PyTorch stores the four gates stacked in the order i, f, g, o inside `weight_ih_l0` (4H×1), `weight_hh_l0` (4H×H) and the two bias vectors. We recompute z = W_ih·xₜ + W_hh·hₜ₋₁ + b_ih + b_hh, split it into four blocks, apply σ/tanh, and update c and h step by step. We then check against `nn.LSTM`'s own forward pass. The maximum difference is about 10⁻⁷ for h and 10⁻⁶ for c across 52 test sequences.

---
*Bonus:* **Recursive vs one-step forecasting?** One-step always uses the true last 24 hours. Recursive feeds predictions back as inputs to forecast many hours ahead, so errors accumulate: trained MAE is about 25 MW for the first 24 recursive hours vs about 15 MW one-step.
