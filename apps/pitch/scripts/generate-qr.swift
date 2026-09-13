// Reproducible QR generation and independent barcode verification on macOS.
// Uses installed Apple CoreImage and Vision frameworks; no package installation.
// Generate: swift apps/pitch/scripts/generate-qr.swift generate apps/pitch/public/brand/specsync-qr.svg
// Verify a rasterized SVG or an extracted video frame: swift apps/pitch/scripts/generate-qr.swift verify /absolute/path/image.png
import Foundation
import CoreImage
import ImageIO
import Vision

let destination = "https://specsync.tubadev.com/"
let arguments = CommandLine.arguments

enum QRFailure: Error { case invalidArguments, generation, image, decode }

func emit(_ value: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
}

func generate(to file: String) throws {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else { throw QRFailure.generation }
    filter.setValue(Data(destination.utf8), forKey: "inputMessage")
    filter.setValue("Q", forKey: "inputCorrectionLevel")
    guard let code = filter.outputImage else { throw QRFailure.generation }
    let image = code.composited(over: CIImage(color: .white).cropped(to: code.extent))
    let context = CIContext()
    guard let bitmap = context.createCGImage(image, from: image.extent) else { throw QRFailure.generation }
    let width = bitmap.width
    let height = bitmap.height
    var pixels = [UInt8](repeating: 255, count: width * height * 4)
    let drawn = pixels.withUnsafeMutableBytes { bytes -> Bool in
        guard let drawing = CGContext(data: bytes.baseAddress, width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        drawing.draw(bitmap, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
    }
    guard drawn else { throw QRFailure.generation }
    func black(_ x: Int, _ y: Int) -> Bool { pixels[(y * width + x) * 4] < 128 }
    var minX = width; var minY = height; var maxX = 0; var maxY = 0
    for y in 0..<height { for x in 0..<width where black(x, y) {
        minX = min(minX, x); minY = min(minY, y); maxX = max(maxX, x); maxY = max(maxY, y)
    }}
    let modules = maxX - minX + 1
    guard modules == maxY - minY + 1, modules >= 21, (modules - 21) % 4 == 0 else { throw QRFailure.generation }
    let quiet = 4
    let total = modules + quiet * 2
    var path = ""
    for y in 0..<modules {
        var x = 0
        while x < modules {
            if !black(minX + x, minY + y) { x += 1; continue }
            let start = x
            while x < modules && black(minX + x, minY + y) { x += 1 }
            path += "M\(start + quiet) \(y + quiet)h\(x-start)v1H\(start + quiet)z"
        }
    }
    let svg = """
    <svg xmlns="http://www.w3.org/2000/svg" width="\(total * 10)" height="\(total * 10)" viewBox="0 0 \(total) \(total)" shape-rendering="crispEdges">
      <title>Experimente o SpecSync</title>
      <desc>\(destination) — Apple CoreImage QR, correction Q, \(modules) by \(modules) modules, four-module white quiet zone on every side.</desc>
      <rect width="\(total)" height="\(total)" fill="#FFFFFF"/>
      <path d="\(path)" fill="#000000"/>
    </svg>
    """
    try svg.write(toFile: file, atomically: true, encoding: .utf8)
    try emit(["url": destination, "modules": modules, "quietZone": quiet, "totalModules": total,
        "correction": "Q", "generator": "Apple CoreImage CIQRCodeGenerator", "output": file])
}

func verify(file: String) throws {
    let url = URL(fileURLWithPath: file)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw QRFailure.image }
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]
    try VNImageRequestHandler(cgImage: image).perform([request])
    let matches = (request.results ?? []).compactMap { $0.payloadStringValue }
    guard matches.contains(destination) else { try emit(["decoded": matches, "expected": destination]); throw QRFailure.decode }
    try emit(["decoded": matches, "matchesExpected": true, "decoder": "Apple Vision VNDetectBarcodesRequest", "width": image.width, "height": image.height])
}

do {
    guard arguments.count == 3 else { throw QRFailure.invalidArguments }
    switch arguments[1] {
    case "generate": try generate(to: arguments[2])
    case "verify": try verify(file: arguments[2])
    default: throw QRFailure.invalidArguments
    }
} catch {
    fputs("QR operation failed: \(error)\n", stderr)
    exit(1)
}
