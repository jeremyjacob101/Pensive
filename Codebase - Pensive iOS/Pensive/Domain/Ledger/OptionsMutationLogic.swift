import Foundation

enum OptionsMutationLogic {
    static func buildMoveToSubtype(kind: String, sourceValue: String, targetValue: String) throws -> MoveToSubtypeRequest {
        let source = sourceValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let target = targetValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !source.isEmpty, !target.isEmpty else { throw APIError.validation(message: "Source and target are required.") }
        guard source != target else { throw APIError.validation(message: "Cannot move an option under itself.") }
        return MoveToSubtypeRequest(kind: kind, sourceValue: source, targetValue: target)
    }

    static func buildMoveSubtype(kind: String, value: String, sourceParentValue: String, targetParentValue: String) throws -> MoveSubtypeRequest {
        let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceParent = sourceParentValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let targetParent = targetParentValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedValue.isEmpty, !sourceParent.isEmpty, !targetParent.isEmpty else { throw APIError.validation(message: "Value and parent values are required.") }
        guard sourceParent != targetParent else { throw APIError.validation(message: "Subtype is already under the selected parent.") }
        return MoveSubtypeRequest(kind: kind, value: trimmedValue, sourceParentValue: sourceParent, targetParentValue: targetParent)
    }

    static func buildPromoteSubtype(kind: String, value: String, parentValue: String) throws -> PromoteSubtypeRequest {
        let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedParent = parentValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedValue.isEmpty, !trimmedParent.isEmpty else { throw APIError.validation(message: "Value and parent are required.") }
        return PromoteSubtypeRequest(kind: kind, value: trimmedValue, parentValue: trimmedParent)
    }
}
