export interface TextHistory {
  record(value: string): void;
  undo(): string | undefined;
  redo(): string | undefined;
}

export function createTextHistory(initialValue: string): TextHistory {
  const values = [initialValue];
  let current = 0;

  return {
    record(value) {
      if (values[current] === value) {
        return;
      }

      values.splice(current + 1);
      values.push(value);
      current = values.length - 1;
    },
    undo() {
      if (current === 0) {
        return undefined;
      }

      current -= 1;
      return values[current];
    },
    redo() {
      if (current === values.length - 1) {
        return undefined;
      }

      current += 1;
      return values[current];
    },
  };
}
