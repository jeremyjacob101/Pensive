export function EditableRowActions({ isEditing, saving, onSave, onCancel, onEdit, onDelete }: {
  isEditing: boolean;
  saving: boolean;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  if (isEditing) {
    return (
      <>
        <button type="button" onClick={() => void onSave()} disabled={saving}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="icon-action-btn"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={() => {
          const confirmed = window.confirm(
            "Are you sure you want to delete this item? This action cannot be undone.",
          );
          if (!confirmed) return;
          void onDelete();
        }}
        disabled={saving}
        aria-label="Delete"
        className="icon-action-btn danger"
      >
        ✕
      </button>
    </>
  );
}
