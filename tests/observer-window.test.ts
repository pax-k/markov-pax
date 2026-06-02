import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  createObserverWindow,
  sequenceLogLikelihood,
  stationaryBelief,
  stationaryMeasureMap,
  traceSurprise,
  traceToWindow,
} from "../index.ts";

describe("observer windows, beliefs, and trace surprise", () => {
  test("wraps chains as observer windows and maps stationary beliefs", () => {
    const chain = MarkovChain.from({
      awake: { awake: 0.7, dreaming: 0.3 },
      dreaming: { awake: 0.4, dreaming: 0.6 },
    });
    const window = createObserverWindow({ name: "mind-state", chain });

    expect(window.name).toBe("mind-state");
    expect(window.visibleStates).toEqual(["awake", "dreaming"]);
    expect(stationaryBelief(window).awake).toBeCloseTo(window.stationaryBelief().awake);
    expect(stationaryMeasureMap(window).dreaming).toBeCloseTo(3 / 7);
  });

  test("creates traced observer windows and scores visible sequences", () => {
    const parent = createObserverWindow({
      name: "traffic-light",
      chain: MarkovChain.from({
        red: { green: 0.5, yellow: 0.5 },
        green: { red: 0.5, yellow: 0.5 },
        yellow: { red: 0.75, green: 0.25 },
      }),
    });

    const traced = traceToWindow(parent, ["red", "green"], { name: "glasses" });
    const methodTrace = parent.traceTo(["red", "green"]);
    expect(traced.name).toBe("glasses");
    expect(traced.parent).toBe(parent);
    expect(methodTrace.parent).toBe(parent);
    expect(sequenceLogLikelihood(traced, ["red", "green", "red"])).toBeLessThan(0);

    const surprise = traceSurprise(parent, ["red", "green"], ["red", "red", "green"]);
    expect(surprise.traceLogLikelihood).toBeGreaterThan(surprise.naiveLogLikelihood);
    expect(surprise.traceSurprise).toBeLessThan(surprise.naiveSurprise);
    expect(surprise.improvement).toBeGreaterThan(0);
    expect(surprise.traceWindow.parent).toBe(parent);
    expect(surprise.naiveWindow.parent).toBe(parent);
  });

  test("rejects invalid observer-window likelihood inputs", () => {
    const window = createObserverWindow({
      chain: MarkovChain.from({
        visible: { visible: 1 },
      }),
    });

    expect(() => createObserverWindow({
      chain: MarkovChain.from({
        visible: { visible: 1 },
      }),
      visibleStates: ["missing" as "visible"],
    })).toThrow(/unknown visible/i);
    expect(() => sequenceLogLikelihood(window, [])).toThrow(/observations/i);
    expect(() => sequenceLogLikelihood(window, ["missing" as "visible"])).toThrow(/Unknown observation/i);

    const twoState = createObserverWindow({
      chain: MarkovChain.from({
        visible: { visible: 1 },
        other: { visible: 1 },
      }),
    });
    expect(sequenceLogLikelihood(twoState, ["visible"], { visible: 0, other: 1 })).toBe(Number.NEGATIVE_INFINITY);
  });
});
