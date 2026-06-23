import SwiftUI

struct UserFeatureView: View {
    let userId: String
    let onSignOut: () -> Void
    let onDeleteAccount: () -> Void

    @State private var accountActionsPresented = false
    @State private var deleteAccountConfirmationPresented = false

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Username", value: userId)
                    .accessibilityIdentifier("user_username_value")
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    accountActionsPresented = true
                }
                    .accessibilityIdentifier("sign_out_button")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("User")
        .navigationBarTitleDisplayMode(.large)
        .confirmationDialog("Account", isPresented: $accountActionsPresented, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive, action: onSignOut)
                .accessibilityIdentifier("account_actions_sign_out_button")
            Button("Delete Account", role: .destructive) {
                deleteAccountConfirmationPresented = true
            }
                .accessibilityIdentifier("account_actions_delete_account_button")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Choose what you want to do with this account.")
        }
        .alert("Delete Account", isPresented: $deleteAccountConfirmationPresented) {
            Button("Cancel", role: .cancel) {}
            Button("Delete Account", role: .destructive, action: onDeleteAccount)
        } message: {
            Text("This action is irrevocable and all data will be irretrievable. Are you sure?")
        }
    }
}

