import regularUrl from "../../assets/graph-fonts/STIXTwoText-Regular.otf?url";
import italicUrl from "../../assets/graph-fonts/STIXTwoText-Italic.otf?url";
import mathUrl from "../../assets/graph-fonts/STIXTwoMath-Regular.otf?url";
import fontLicense from "../../assets/graph-fonts/OFL.txt?raw";
let fonts: Promise<string> | undefined;
export async function embedPortableFonts(svg: string): Promise<string> {
  fonts ??= Promise.all(
    [regularUrl, italicUrl, mathUrl].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok)
        throw Error("The portable print font could not be loaded.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return btoa(binary);
    }),
  )
    .then(
      ([regular, italic, math]) =>
        `<style>@font-face{font-family:'STIX Two Text';font-style:normal;src:url(data:font/otf;base64,${regular})}@font-face{font-family:'STIX Two Text';font-style:italic;src:url(data:font/otf;base64,${italic})}@font-face{font-family:'STIX Two Math';src:url(data:font/otf;base64,${math})}</style>`,
    )
    .catch((error) => {
      fonts = undefined;
      throw error;
    });
  const notice =
    "<!-- Bundled STIX fonts: " + fontLicense.replaceAll("--", "—") + " -->";
  return svg.replace(/(<svg\b[^>]*>)/, `$1${notice}${await fonts}`);
}
