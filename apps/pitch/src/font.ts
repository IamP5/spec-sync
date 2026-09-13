import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";

if (typeof document !== "undefined") {
  const handle = delayRender("Loading the bundled Inter font");
  const font = new FontFace(
    "Pitch Inter",
    `url(${staticFile("fonts/inter-latin.woff2")})`,
    { weight: "100 900" },
  );
  font
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch(cancelRender);
}

export const fontFamily = "Pitch Inter, Arial, sans-serif";
