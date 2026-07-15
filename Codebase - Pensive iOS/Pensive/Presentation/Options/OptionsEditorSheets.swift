import SwiftUI

struct OptionCreateSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: OptionsViewModel
    let selectedKind: OptionsKind
    @Binding var draft: OptionCreateDraft
    @State private var isSaving = false
    @State private var saveError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $draft.value)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)

                    if selectedKind.supportsNestedOptions {
                        Toggle("Add as subtype", isOn: $draft.addAsSubtype)
                            .onChange(of: draft.addAsSubtype) { _, _ in
                                draft.parentValue = ""
                            }
                    }

                    if addKind.supportsParent {
                        Picker("Parent", selection: $draft.parentValue) {
                            Text("Select Parent").tag("")
                            ForEach(viewModel.parentChoices(for: addKind), id: \.self) { parent in
                                Text(parent).tag(parent)
                            }
                        }
                    }

                    ColorPicker(
                        "Color",
                        selection: Binding(
                            get: { optionCreateColor(from: draft.color) ?? .pink },
                            set: { draft.color = optionCreateHex(from: $0) ?? draft.color }
                        ),
                        supportsOpacity: false
                    )
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        Text("Create")
                    }
                    .disabled(isCreateDisabled || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
        .alert("Couldn't create option", isPresented: Binding(get: { saveError != nil }, set: { if !$0 { saveError = nil } })) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private var addKind: OptionsKind {
        draft.addAsSubtype ? (viewModel.childKind(for: selectedKind) ?? selectedKind) : selectedKind
    }

    private var title: String {
        switch addKind {
        case .account: return "New Account"
        case .category: return "New Category"
        case .subcategory: return "New Subcategory"
        case .incomeType: return "New Income Type"
        case .incomeSubtype: return "New Income Subtype"
        }
    }

    private var isCreateDisabled: Bool {
        let hasName = !draft.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasParent = !addKind.supportsParent || !draft.parentValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return !hasName || !hasParent
    }

    private func optionCreateColor(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }

    private func optionCreateHex(from color: Color) -> String? {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return nil }
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let didSave = await viewModel.add(
            kind: addKind,
            value: draft.value,
            parentValue: draft.parentValue,
            color: draft.color
        )
        if didSave {
            dismiss()
        } else {
            saveError = viewModel.inlineError ?? "Please check your connection and try again."
            viewModel.inlineError = nil
        }
    }
}

struct OptionEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: OptionsViewModel
    let row: OptionsDisplayRow
    @State private var draft: OptionEditDraft
    @State private var showDeleteConfirmation = false
    @State private var addAsSubtype = false
    @State private var selectedSubtypeParent = ""
    @State private var isSaving = false
    @State private var saveError: String?

    init(viewModel: OptionsViewModel, row: OptionsDisplayRow) {
        self.viewModel = viewModel
        self.row = row
        _draft = State(initialValue: OptionEditDraft(row: row))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Name") {
                        TextField("", text: $draft.value)
                            .textInputAutocapitalization(.words)
                            .submitLabel(.done)
                            .multilineTextAlignment(.trailing)
                    }

                    ColorPicker(
                        "Color",
                        selection: Binding(
                            get: { optionEditColor(from: draft.color) ?? .pink },
                            set: { draft.color = optionEditHex(from: $0) ?? draft.color }
                        ),
                        supportsOpacity: false
                    )

                    if canMoveToSubtype {
                        Toggle("Add as subtype", isOn: $addAsSubtype)
                            .onChange(of: addAsSubtype) { _, isEnabled in
                                if !isEnabled {
                                    selectedSubtypeParent = ""
                                }
                            }

                        if addAsSubtype {
                            Picker("Parent", selection: $selectedSubtypeParent) {
                                Text("Select Parent").tag("")
                                ForEach(subtypeTargets, id: \.self) { parent in
                                    Text(parent).tag(parent)
                                }
                            }
                        }
                    }

                    if canPromoteSubtype {
                        Button(promoteButtonTitle) {
                            Task { await promote() }
                        }
                        .disabled(isSaving)
                    }
                }

                Section {
                    Button("Delete", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .listSectionSpacing(.compact)
            .contentMargins(.top, 8, for: .scrollContent)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.height(300), .medium])
            .presentationDragIndicator(.visible)
            .confirmationDialog("Delete option?", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        isSaving = true
                        defer { isSaving = false }
                        if await viewModel.remove(kind: row.kind, value: row.value, parentValue: row.parentValue) {
                            dismiss()
                        } else {
                            saveError = viewModel.inlineError ?? "Please check your connection and try again."
                            viewModel.inlineError = nil
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        Text("Save")
                    }
                    .disabled(!hasChanges || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
        .alert("Couldn't save option", isPresented: Binding(get: { saveError != nil }, set: { if !$0 { saveError = nil } })) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private var title: String {
        switch row.kind {
        case .account: return "Edit Account"
        case .category: return "Edit Category"
        case .subcategory: return "Edit Subcategory"
        case .incomeType: return "Edit Income Type"
        case .incomeSubtype: return "Edit Income Subtype"
        }
    }

    private var hasChanges: Bool {
        let nextName = draft.value.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(draft.color)
        let hasFieldChanges = nextName != row.value || (nextColor != nil && nextColor != normalizedHex(row.color))
        return !nextName.isEmpty && (hasFieldChanges || hasValidSubtypeTarget)
    }

    private var subtypeTargets: [String] {
        guard row.kind.supportsNestedOptions else { return [] }
        return viewModel.moveToSubtypeTargets(kind: row.kind, excluding: row.value)
    }

    private var canMoveToSubtype: Bool {
        row.kind.supportsNestedOptions && !rowHasChildren && !subtypeTargets.isEmpty
    }

    private var rowHasChildren: Bool {
        guard let childKind = viewModel.childKind(for: row.kind) else { return false }
        return (viewModel.optionsByKind[childKind] ?? []).contains { child in
            (child.parentValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines) == row.value
        }
    }

    private var hasValidSubtypeTarget: Bool {
        addAsSubtype && !selectedSubtypeParent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canPromoteSubtype: Bool {
        row.kind.supportsParent && !(row.parentValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var promoteButtonTitle: String {
        switch row.kind {
        case .subcategory:
            return "Promote to Own Category"
        case .incomeSubtype:
            return "Promote to Own Income Type"
        default:
            return "Promote to Own Category"
        }
    }

    private func saveChanges() async -> Bool {
        let nextName = draft.value.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextColor = normalizedHex(draft.color) ?? row.color
        let nameChanged = !nextName.isEmpty && nextName != row.value
        let colorChanged = normalizedHex(nextColor) != normalizedHex(row.color)

        if nameChanged {
            guard await viewModel.rename(kind: row.kind, value: row.value, nextValue: nextName, parentValue: row.parentValue) else { return false }
        }

        if colorChanged {
            guard await viewModel.updateColor(kind: row.kind, value: nameChanged ? nextName : row.value, color: nextColor, parentValue: row.parentValue) else { return false }
        }

        if hasValidSubtypeTarget {
            guard await viewModel.moveToSubtype(
                kind: row.kind,
                sourceValue: nameChanged ? nextName : row.value,
                targetValue: selectedSubtypeParent
            ) else { return false }
        }
        return true
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        if await saveChanges() {
            dismiss()
        } else {
            saveError = viewModel.inlineError ?? "Please check your connection and try again."
            viewModel.inlineError = nil
        }
    }

    private func promote() async {
        isSaving = true
        defer { isSaving = false }
        if await viewModel.promoteSubtype(kind: row.kind, value: row.value, parentValue: row.parentValue ?? "") {
            dismiss()
        } else {
            saveError = viewModel.inlineError ?? "Please check your connection and try again."
            viewModel.inlineError = nil
        }
    }

    private func optionEditColor(from hex: String) -> Color? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard clean.count == 6, let value = Int(clean, radix: 16) else { return nil }
        let red = Double((value >> 16) & 0xff) / 255.0
        let green = Double((value >> 8) & 0xff) / 255.0
        let blue = Double(value & 0xff) / 255.0
        return Color(red: red, green: green, blue: blue)
    }

    private func optionEditHex(from color: Color) -> String? {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return nil }
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }

    private func normalizedHex(_ hex: String) -> String? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: "#", with: "")
        guard clean.range(of: #"^[0-9A-F]{6}$"#, options: .regularExpression) != nil else { return nil }
        return "#\(clean)"
    }
}
