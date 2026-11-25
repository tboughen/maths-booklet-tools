const previews = import.meta.glob<string>("../assets/example-previews/*.svg", {
  eager: true,
  query: "?no-inline",
  import: "default",
});

/** An example's preview picture, the same one its gallery card shows. */
export const previewUrl = (id: string): string | undefined => previews[`../assets/example-previews/${id}.svg`];

/** The address parameter that opens a gallery example when its tool loads, such as ?example=solids-plain-cylinder. */
export const EXAMPLE_PARAM = "example";
