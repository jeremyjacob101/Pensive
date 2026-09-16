import SwiftUI

extension View {
    @ViewBuilder
    func debugBuildBanner() -> some View {
        #if DEBUG
        overlay(alignment: .top) {
            DebugBuildBanner()
                .allowsHitTesting(false)
        }
        #else
        self
        #endif
    }
}

#if DEBUG
private struct DebugBuildBanner: View {
    var body: some View {
        ZStack {
            Color.yellow

            DiagonalStripes()
                .stroke(Color.black.opacity(0.18), lineWidth: 6)

            Text("DEBUG BUILD")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .tracking(1.2)
                .foregroundStyle(.black.opacity(0.78))
        }
        .frame(maxWidth: .infinity)
        .frame(height: 28)
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("debug_build_banner")
        .accessibilityLabel("Debug build")
    }
}

private struct DiagonalStripes: Shape {
    private let stripeSpacing: CGFloat = 16

    func path(in rect: CGRect) -> Path {
        var path = Path()
        var x = -rect.height

        while x < rect.width + rect.height {
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x + rect.height, y: rect.height))
            x += stripeSpacing
        }

        return path
    }
}
#endif
