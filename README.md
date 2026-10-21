# SignalLab: Modulation Comparison for Wireless Sensor Links Using ASK & FSK

A software-only simulator for a Short Range Wireless Communication (SRWC) mini-project. A simulated sensor node sends temperature and humidity packets using **ASK (on-off keying)** or **binary FSK** through a configurable wireless channel. The receiver demodulates the noisy waveform, and the app measures bit error rate and packet delivery.

No hardware is required. Every waveform, chart and metric comes from the simulation engine in `src/engine`. Nothing is hard-coded or decorative.

## Quick start

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # opens on http://localhost:5173 (or the next free port)
npm test           # 22 engine tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Using the app

| Section | Purpose |
| --- | --- |
| **Overview** | What the project is, and links into the demo and experiments. |
| **Guided Demo** | Six steps: Sensor data → Modulation → Channel → Transmit → Receive → Compare. Includes Presentation Mode (larger layout, hidden navigation, ← / → keys, Esc to exit) and presenter notes for each step. |
| **Experiments** | Parameter sweeps over SNR, distance and payload size, with repetitions, progress, results table, five charts, best-configuration finder, and CSV / JSON / summary export. Results are saved in the browser (localStorage). |
| **Learn** | Theory, an interactive bit-by-bit waveform builder, a noise demo, equations, limitations, and a conclusion written from *your* saved results. |

The **Technical notes** switch in the sidebar shows extra engineering detail throughout the app.

## Architecture

```
src/
  engine/              Pure TypeScript simulation (no UI imports, fully unit-tested)
    types.ts           Shared types (SensorReading, SimParams, LinkResult …)
    rng.ts             Seeded PRNG (mulberry32) + Box–Muller Gaussian, seed hashing
    bits.ts, crc.ts    Bit/byte conversion, CRC-16/CCITT-FALSE
    packet.ts          Packet encode/decode/validation
    sensor.ts          Simulated sensor readings
    params.ts          Defaults and parameter validation (Nyquist, tone spacing …)
    modulation.ts      OOK-ASK and continuous-phase FSK modulators
    channel.ts         Path loss, AWGN, Rayleigh block fading, tone interference
    demodulation.ts    Non-coherent ASK envelope detector, FSK dual-correlator detector
    link.ts            Full pipeline for one packet
    experiment.ts      Parameter-sweep runner, best-point selection
    metrics.ts         BER, PDR, loss, statistics, two-proportion significance test
    insights.ts        Plain-English explanations generated from measured results
    fft.ts             Radix-2 FFT + windowed magnitude spectrum
    downsample.ts      Min/max decimation for charts
  workers/             Web Worker that runs experiments off the main thread
  lib/                 Storage, export, formatting, runner hook, settings
  components/          Reusable UI (Stepper, SignalChart, MetricCard, ParameterSlider …)
  pages/               Overview, Experiments, Learn, demo/ (the six guided steps)
```

There is no backend: everything runs in the browser, and the TypeScript engine is tested directly with Vitest.

## Pipeline and formulas

**Packet (15 + P bytes, big-endian):** sync `0x7E` · node ID (u8) · sequence (u16) · Unix timestamp (u32) · temperature (i16, °C×100) · humidity (u16, %×100) · padding length P (u8) · P padding bytes · CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). The default frame is 120 bits. Bits are sent MSB first.

**Modulation** (sample rate fs = bit rate × samples per bit; defaults 1 kbit/s × 32 = 32 kHz):

- ASK / OOK: `s(t) = A(b)·sin(2π fc t)`, with A(1) = A and A(0) = 0. Default fc = 4 kHz.
- CP-FSK: `s(t) = A·sin(φ(t))`, `dφ/dt = 2π f_b`, where f0 = fc − Δf/2 and f1 = fc + Δf/2 (defaults 3 kHz / 5 kHz). The phase is continuous across bit boundaries.
- Optional *equal-energy ASK* scales the ASK amplitude by √2 so both schemes radiate the same average energy. By default they use the same **peak** amplitude.

**Channel:** `r[n] = h·g(d)·s[n] + i[n] + w[n]`

- Log-distance path loss: `PL(d) = 10·n·log10(d / 1 m)` dB, with n = 2 by default.
- AWGN: the SNR control is the Ec/N0 of a reference carrier (A = 1) at 1 m, so `σ² = N / (4·10^(SNR/10))` for N samples per bit. Received Ec/N0 = SNR + 20·log10(A) − PL(d) (+ fading).
- Rayleigh block fading (optional): one gain per packet, E[h²] = 1.
- Interference (optional): a sine tone with configurable level and frequency, and random phase.
- With a fixed seed, every run is reproducible. ASK and FSK receive the **same** noise realisation for each packet (common random numbers).

**Receivers** (non-coherent, ideal bit timing):

- ASK: `â = (2/N)·√(I² + Q²)` at fc. The bit is 1 if â > τ·A·g(d), where τ is the threshold setting. The receiver is calibrated for path loss, but not for fading.
- FSK: correlator energies E0 and E1 at f0 and f1. The bit is 1 if E1 > E0.

**Metrics**

- `BER = incorrect recovered bits / total transmitted bits compared`. All bits are compared, including header and CRC.
- `PDR = valid packets delivered / packets transmitted × 100`. A packet counts as delivered only if the CRC passes, all fields are in range **and** every recovered bit equals the transmitted bit. An undetected CRC collision counts as a loss.
- `Packet loss = 100 − PDR`.
- Processing time is JavaScript compute time per packet. It is **not** radio or hardware latency. On-air time (bits ÷ bit rate) is reported separately.
- Energy model: radiated signal energy `Σs²/fs` per packet, in normalised units. Energy per delivered packet = total energy ÷ delivered packets. Circuit power is not modelled.
- Observations only call a winner when a two-proportion z-test is significant (≈95 %). Otherwise the result is reported as a tie.

**Validation against theory:** at 10 dB, non-coherent FSK measured BER ≈ 3.2×10⁻³, compared with the theoretical 0.5·e^(−Eb/2N0) ≈ 3.4×10⁻³.

## Running experiments

1. Open **Experiments**, then pick an example (BER vs SNR, PDR vs distance, Fading channel) or enter your own values. Lists can be written as `0, 5, 10` or as `start:step:stop`, e.g. `0:5:25`.
2. Choose ASK, FSK or Both, plus packets per point and (under *More sweep options*) repetitions, payload sizes and bit rate.
3. Click **Run Experiment**. The sweep runs in a Web Worker with live progress and can be cancelled.
4. Inspect the charts, results table and best configuration. Export as CSV, JSON or a text summary.
5. Results from example presets are labelled *Demonstration preset*. History survives page reloads. **Clear all** asks for confirmation first.

## Tests

`npm test` covers: noiseless ASK and FSK round-trips, bit recovery through the full link, empty and invalid payloads, seed determinism, BER/PDR/loss maths, checksum failure detection (every single-bit flip), very-low-SNR behaviour (delivery is never claimed when bits differ), the experiment runner (counts, progress, reproducibility, validation, cancellation), BER decreasing with SNR, FFT peak locations, and the significance test.

## Limitations

- Frequencies are scaled to kHz so that every cycle can be sampled and plotted. These are not real 433 MHz or 2.4 GHz signals.
- Amplitudes and energies are in normalised units, not watts or dBm. The SNR is a 1 m reference value, not derived from real transmit power, antennas or noise figure.
- Perfect bit and frame synchronisation: there is no preamble detection, clock recovery or carrier-frequency offset.
- The channel is simple: log-distance path loss, flat block Rayleigh fading and a single interfering tone. There is no multipath delay spread, Doppler or shadowing.
- Results are **software simulations** and must not be presented as hardware measurements.
