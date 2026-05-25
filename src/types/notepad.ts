export type NotepadTable = {
  id: string;
  title: string;
  cells: string[][];
};

export type NotepadNote = {
  id: string;
  title: string;
  content: string;
};

export type SizeMap = Record<string, number[]>;
