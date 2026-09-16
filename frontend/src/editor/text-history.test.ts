import { expect, test } from "vitest";

import { createTextHistory } from "./text-history";

test("undoes a pasted value in one step", () => {
  const history = createTextHistory("x");
  history.record("x+\\frac{a}{b}");

  expect(history.undo()).toBe("x");
});

test("redoes an undone value", () => {
  const history = createTextHistory("x");
  history.record("x+y");
  history.undo();

  expect(history.redo()).toBe("x+y");
});

test("drops redo history after a new edit", () => {
  const history = createTextHistory("x");
  history.record("x+y");
  history.undo();
  history.record("x+z");

  expect(history.redo()).toBeUndefined();
});

test("undoes consecutive pastes in reverse paste order", () => {
  const history = createTextHistory("x");
  history.record("x+first paste");
  history.record("x+first pastesecond paste");

  expect(history.undo()).toBe("x+first paste");
  expect(history.undo()).toBe("x");
});
