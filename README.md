# Irish Valuation List

This website is an **independent proof of concept** demonstrating how a
Mapbox Vector Tile endpoint can be incorporated into an application built with
the ArcGIS Maps SDK for JavaScript to present a map-based valuation list of
properties.

It is intended for technical exploration and evaluation of:

- Rendering Mapbox Vector Tile data with an ArcGIS `VectorTileLayer`
- Combining the vector-tile layer with an Esri basemap
- Using ArcGIS map widgets such as `LayerList`, `Legend`, `BasemapGallery`,
  and `Search`
- Displaying parcel information and retrieving example valuation-report data

## Important notice

**This is not a product of Tailte Éireann.** It is not operated, endorsed,
maintained, or supported by Tailte Éireann, and the styling and layout in this
proof of concept should not be interpreted as an official Tailte Éireann
website or service.

The application uses publicly accessible Tailte Éireann open-data endpoints
for demonstration purposes. Refer to the relevant data provider's terms,
licensing, and service availability before using the data.

## Live demonstration

The proof of concept is published at:

<https://pjmclaughlin1979.github.io/irish-parcel-viewer/>

## Technology

- React
- TypeScript
- Vite
- ArcGIS Maps SDK for JavaScript 5.x
- Tailte Éireann open-data Mapbox Vector Tile endpoint

## Run locally

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```

The production build is deployed to GitHub Pages by the workflow in
`.github/workflows/deploy-pages.yml`.

## Data endpoints

The proof of concept references:

- Parcel vector tiles:
  `https://opendata.tailte.ie/api/layers/parcels/{x}/{y}/{z}`
- Example property details:
  `https://opendata.tailte.ie/api/Property/GetProperties`
- Esri World Topographic Map basemap:
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer`

Endpoint availability, response formats, attribution requirements, and usage
permissions are outside the scope of this demonstration and may change.

## Scope and limitations

This repository demonstrates an integration approach; it is not a
production-ready cadastral, valuation, or property information system. It
does not provide official legal, valuation, planning, or ownership advice.
Production use would require appropriate design review, accessibility testing,
security review, operational support, data governance, and agreement with the
relevant data providers.
