import SwiftUI

struct AppShellView: View {
    let userId: String
    let api: ConvexAPI
    let onSignOut: () -> Void
    let onDeleteAccount: () -> Void

    @SceneStorage("shell.selectedTab") private var selectedTabRaw = AppTab.defaultTab.rawValue
    @SceneStorage("shell.path.expenses") private var expensesPathData: Data?
    @SceneStorage("shell.path.incomings") private var incomingsPathData: Data?
    @SceneStorage("shell.path.breakdown") private var breakdownPathData: Data?
    @SceneStorage("shell.path.recurrings") private var recurringsPathData: Data?
    @SceneStorage("shell.path.tracking") private var trackingPathData: Data?
    @SceneStorage("shell.path.notepad") private var notepadPathData: Data?
    @SceneStorage("shell.path.options") private var optionsPathData: Data?
    @SceneStorage("shell.path.user") private var userPathData: Data?

    @State private var selectedTab: AppTab = .defaultTab
    @State private var pathByTab: [AppTab: NavigationPath] = [:]
    @State private var quickAddPresented = false
    @StateObject private var quickAddVM = QuickAddFormViewModel()

    var body: some View {
        ZStack(alignment: .topLeading) {
            NavigationStack(path: binding(for: selectedTab)) {
                FeatureRootView(tab: selectedTab, userId: userId, api: api, onSignOut: onSignOut, onDeleteAccount: onDeleteAccount) {
                    quickAddPresented = true
                }
            }
            .id(selectedTab)
            .accessibilityIdentifier("tab_\(selectedTab.rawValue)")

            ShellNavigationMenu(selectedTab: $selectedTab)
                .padding(.leading, 12)
                .padding(.top, 2)

            Rectangle()
                .fill(.clear)
                .frame(width: 1, height: 1)
                .accessibilityElement(children: .ignore)
                .accessibilityIdentifier("tab_\(selectedTab.rawValue)")
                .accessibilityLabel(selectedTab.title)
                .accessibilityHidden(false)
                .allowsHitTesting(false)
        }
        .sheet(isPresented: $quickAddPresented, onDismiss: {
            quickAddVM.reset()
        }) {
            QuickAddSheet(viewModel: quickAddVM) {
                quickAddPresented = false
            }
            .presentationDetents([.medium, .large])
            .accessibilityIdentifier("quick_add_sheet")
        }
        .onAppear {
            restoreSelectedTabIfNeeded()
            restorePathsIfNeeded()
        }
        .onChange(of: selectedTab) { _, newValue in
            selectedTabRaw = newValue.rawValue
        }
        .onOpenURL { url in
            apply(deepLink: ShellDeepLink.parse(url: url))
        }
    }

    private func binding(for tab: AppTab) -> Binding<NavigationPath> {
        Binding {
            pathByTab[tab, default: NavigationPath()]
        } set: { newValue in
            pathByTab[tab] = newValue
            persist(path: newValue, for: tab)
        }
    }

    private func restoreSelectedTabIfNeeded() {
        selectedTab = AppTab(rawValue: selectedTabRaw) ?? .defaultTab
    }

    private func restorePathsIfNeeded() {
        for tab in AppTab.allCases {
            pathByTab[tab] = restorePath(for: tab)
        }
    }

    private func apply(deepLink: ShellDeepLink?) {
        guard let deepLink else { return }
        if let tab = deepLink.tab {
            selectedTab = tab
        }
        if let quickAddKind = deepLink.quickAddKind {
            quickAddVM.kind = quickAddKind
            quickAddPresented = true
        }
    }

    private func persist(path: NavigationPath, for tab: AppTab) {
        guard let codable = path.codable else {
            setPathData(nil, for: tab)
            return
        }

        do {
            let data = try JSONEncoder().encode(codable)
            setPathData(data, for: tab)
        } catch {
            setPathData(nil, for: tab)
        }
    }

    private func restorePath(for tab: AppTab) -> NavigationPath {
        guard let data = pathData(for: tab) else { return NavigationPath() }

        do {
            let codable = try JSONDecoder().decode(NavigationPath.CodableRepresentation.self, from: data)
            return NavigationPath(codable)
        } catch {
            return NavigationPath()
        }
    }

    private func pathData(for tab: AppTab) -> Data? {
        switch tab {
        case .expenses: return expensesPathData
        case .incomings: return incomingsPathData
        case .breakdown: return breakdownPathData
        case .recurrings: return recurringsPathData
        case .tracking: return trackingPathData
        case .notepad: return notepadPathData
        case .options: return optionsPathData
        case .user: return userPathData
        }
    }

    private func setPathData(_ value: Data?, for tab: AppTab) {
        switch tab {
        case .expenses: expensesPathData = value
        case .incomings: incomingsPathData = value
        case .breakdown: breakdownPathData = value
        case .recurrings: recurringsPathData = value
        case .tracking: trackingPathData = value
        case .notepad: notepadPathData = value
        case .options: optionsPathData = value
        case .user: userPathData = value
        }
    }
}
private struct ShellNavigationMenu: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        Menu {
            Button {
                selectedTab = selectedTab
            } label: {
                Label(menuTitle(for: selectedTab), image: selectedTab.assetName)
            }
            .accessibilityIdentifier("menu_tab_\(selectedTab.rawValue)")

            Divider()

            ForEach(AppTab.allCases.filter { $0 != selectedTab }, id: \.self) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    Label(menuTitle(for: tab), image: tab.assetName)
                }
                .accessibilityIdentifier("menu_tab_\(tab.rawValue)")
            }
        } label: {
            Image(selectedTab.assetName)
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 24, height: 24)
                .foregroundStyle(selectedTab.color)
                .frame(width: 48, height: 48)
                .shellNavigationGlassCircle()
                .contentShape(Circle())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Navigation Menu")
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("shell_navigation_menu")
        .accessibilityLabel("Navigation Menu")
    }

    private func menuTitle(for tab: AppTab) -> String {
        tab == .user ? "Sign Out" : tab.title
    }
}

private extension View {
    @ViewBuilder
    func shellNavigationGlassCircle() -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular.interactive(), in: Circle())
        } else {
            shellNavigationMaterialCircle()
        }
        #else
        shellNavigationMaterialCircle()
        #endif
    }

    func shellNavigationMaterialCircle() -> some View {
        background(.ultraThinMaterial, in: Circle())
            .overlay(
                Circle()
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
    }
}
