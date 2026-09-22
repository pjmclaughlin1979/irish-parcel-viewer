import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Map from "@arcgis/core/Map.js";
import Basemap from "@arcgis/core/Basemap.js";
import MapView from "@arcgis/core/views/MapView.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import VectorTileLayer from "@arcgis/core/layers/VectorTileLayer.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import LayerList from "@arcgis/core/widgets/LayerList.js";
import Expand from "@arcgis/core/widgets/Expand.js";
import Legend from "@arcgis/core/widgets/Legend.js";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery.js";
import Search from "@arcgis/core/widgets/Search.js";
import type { PopupTemplateCreatorEvent } from "@arcgis/core/popup/types.js";
import type { GraphicHit } from "@arcgis/core/views/types.js";

const PARCEL_TILE_URL =
  "https://opendata.tailte.ie/api/layers/parcels/{x}/{y}/{z}";
const ESRI_TOPO_URL =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer";
const PROPERTY_API_URL = "https://opendata.tailte.ie/api/Property/GetProperties";

const IRELAND_VIEW = {
  center: [-6.26, 53.35] as [number, number],
  zoom: 15,
};

const parcelTileInfo = {
  rows: 512,
  cols: 512,
  dpi: 96,
  format: "pbf",
  origin: { x: -20037508.342787, y: 20037508.342787 },
  spatialReference: { wkid: 102100 },
  lods: Array.from({ length: 23 }, (_, level) => ({
    level,
    resolution: 78271.516964 / 2 ** level,
    scale: 295828763.7957775 / 2 ** level,
  })),
};

const categoryColors = [
  ["105", "#1b9e77"],
  ["374", "#d95f02"],
  ["183", "#7570b3"],
  ["395", "#e7298a"],
  ["231", "#66a61e"],
  ["751", "#e6ab02"],
  ["111", "#a6761d"],
  ["108", "#666666"],
] as const;

const localAuthorities = [
  ["Carlow County Council", "CAR"],
  ["Cavan County Council", "CAV"],
  ["Clare County Council", "CLA"],
  ["Cork City Council", "CC"],
  ["Cork County Council", "CO"],
  ["Donegal County Council", "DON"],
  ["Dublin City Council", "DCC"],
  ["Dún Laoghaire-Rathdown County Council", "DLR"],
  ["Fingal County Council", "FNG"],
  ["Galway City Council", "GCC"],
  ["Galway County Council", "GAL"],
  ["Kerry County Council", "KER"],
  ["Kildare County Council", "KIL"],
  ["Kilkenny County Council", "KK"],
  ["Laois County Council", "LAO"],
  ["Leitrim County Council", "LEI"],
  ["Limerick City and County Council", "LIM"],
  ["Longford County Council", "LON"],
  ["Louth County Council", "LOU"],
  ["Mayo County Council", "MAY"],
  ["Meath County Council", "MEA"],
  ["Monaghan County Council", "MON"],
  ["Offaly County Council", "OFF"],
  ["Roscommon County Council", "ROS"],
  ["Sligo County Council", "SLI"],
  ["South Dublin County Council", "SDC"],
  ["Tipperary County Council", "TIP"],
  ["Waterford City and County Council", "WAT"],
  ["Westmeath County Council", "WES"],
  ["Wexford County Council", "WEX"],
  ["Wicklow County Council", "WIC"],
] as const;

const valuationCategories = [
  ["Office", "105"],
  ["Retail", "374"],
  ["Industrial", "183"],
  ["Hotel and guest accommodation", "395"],
  ["Residential", "231"],
  ["Agricultural", "751"],
  ["Health and community", "111"],
  ["Other property use", "108"],
] as const;

type ValuationReportProperty = {
  Area: number;
  Nav: number;
  FloorUse: string;
  NavPerM2: number;
  Level: string;
};

type TailteProperty = {
  PropertyNumber: number;
  LocalAuthority: string;
  Category: string;
  Uses: string;
  Address1: string;
  Address2: string;
  Address3: string;
  Eircode: string;
  PublicationDate: string;
  ValuationDate: string;
  Valuation: number;
  AdditionalItems: number;
  ValuationReport: ValuationReportProperty[];
};

function createParcelStyle(filter: {
  localAuthority: string;
  category: string;
}) {
  const layer = {
    id: "parcel-points",
    type: "circle",
    source: "parcels",
    "source-layer": "parcels",
    paint: {
      "circle-color": [
        "match",
        ["get", "catUseCode"],
        ...categoryColors.flatMap(([code, color]) => [code, color]),
        "#f7c873",
      ],
      "circle-opacity": 0.8,
      "circle-radius": 4,
      "circle-stroke-color": "#7f4817",
      "circle-stroke-width": 1,
    },
    ...(filter.localAuthority || filter.category
      ? {
          filter: [
            "all",
            ...(filter.localAuthority
              ? [["==", ["get", "retLoc"], filter.localAuthority]]
              : []),
            ...(filter.category
              ? [["==", ["get", "catUseCode"], filter.category]]
              : []),
          ],
        }
      : {}),
  };

  return {
  version: 8,
  glyphs: "",
  sprite: "",
  sources: {
    parcels: {
      type: "vector",
      tiles: [PARCEL_TILE_URL],
      minzoom: 0,
      maxzoom: 22,
      tileSize: 512,
      tileInfo: parcelTileInfo,
    },
  },
    layers: [layer],
  };
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
      }).format(value)
    : "—";
}

function createReportContent(event: PopupTemplateCreatorEvent): HTMLElement {
  const container = document.createElement("div");
  const propertyNumber = event.graphic.attributes?.propNumber;
  const button = document.createElement("button");
  button.className = "parcel-report-button";
  button.type = "button";
  button.textContent = "View valuation report";
  button.disabled = propertyNumber === null || propertyNumber === undefined;
  container.append(button);

  if (button.disabled) {
    return container;
  }

  button.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("tailte:show-report", {
        detail: { propertyNumber: String(propertyNumber), open: true },
      }),
    );
  });

  return container;
}

export default function App() {
  const mapElement = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportProperty, setReportProperty] = useState<TailteProperty | null>(
    null,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [localAuthorityFilter, setLocalAuthorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState({
    localAuthority: "",
    category: "",
  });
  const parcelLayer = useRef<VectorTileLayer | null>(null);
  useEffect(() => {
    const showReport = (event: Event) => {
      const detail = (event as CustomEvent<{
        propertyNumber: string;
        open?: boolean;
      }>).detail;
      const propertyNumber = detail.propertyNumber;
      if (detail.open) {
        setReportOpen(true);
      }
      setReportLoading(true);
      setReportError(null);
      setReportProperty(null);

      const url = new URL(PROPERTY_API_URL);
      url.searchParams.set("PropertyNumber", propertyNumber);
      url.searchParams.set("Fields", "*");
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          return response.json() as Promise<TailteProperty[]>;
        })
        .then((properties) => {
          setReportProperty(properties[0] ?? null);
          if (!properties[0]) {
            setReportError("No valuation report was found for this property.");
          }
        })
        .catch((error: unknown) => {
          console.error("Failed to load Tailte Éireann valuation report", error);
          setReportError("The valuation report could not be loaded.");
        })
        .finally(() => setReportLoading(false));
    };

    window.addEventListener("tailte:show-report", showReport);
    return () => window.removeEventListener("tailte:show-report", showReport);
  }, []);

  useEffect(() => {
    if (!mapElement.current) return;

    const topoLayer = new TileLayer({
      id: "esri-topographic",
      title: "Esri Topographic",
      url: ESRI_TOPO_URL,
    });
    const layer = new VectorTileLayer({
      id: "parcels",
      title: "Tailte Éireann parcels",
      style: createParcelStyle(appliedFilter),
      visible: true,
    });
    parcelLayer.current = layer;
    const parcelPopup = new PopupTemplate({
      title: "Parcel details",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "propNumber", label: "Property number" },
            { fieldName: "tfa", label: "Total floor area", format: { places: 1 } },
            { fieldName: "val", label: "Valuation", format: { places: 0, digitSeparator: true } },
          ],
        },
        {
          type: "custom",
          creator: createReportContent,
        },
      ],
    });

    const map = new Map({
      basemap: new Basemap({
        baseLayers: [topoLayer],
        title: "Esri Topographic",
        id: "esri-topographic",
      }),
      layers: [layer],
    });

    const mapView = new MapView({
      container: mapElement.current,
      map,
      center: IRELAND_VIEW.center,
      zoom: IRELAND_VIEW.zoom,
      constraints: {
        minZoom: 5,
      },
    });
    mapView.popupEnabled = false;
    const layerList = new LayerList({
      view: mapView,
      listItemCreatedFunction: ({ item }) => {
        item.panel = {
          content: "legend",
        };
      },
    });
    const layerListExpand = new Expand({
      view: mapView,
      content: layerList,
      expandIcon: "layers",
      expandTooltip: "Show layers",
      collapseTooltip: "Hide layers",
    });
    mapView.ui.add(layerListExpand, "top-left");
    const basemapGallery = new BasemapGallery({
      view: mapView,
      source: {
        portal: { url: "https://www.arcgis.com" },
      },
    });
    const basemapGalleryExpand = new Expand({
      view: mapView,
      content: basemapGallery,
      expandIcon: "basemap",
      expandTooltip: "Show basemaps",
      collapseTooltip: "Hide basemaps",
    });
    mapView.ui.add(basemapGalleryExpand, "top-left");
    const legend = new Legend({
      view: mapView,
      layerInfos: [{ layer, title: "Category use code" }],
    });
    const legendExpand = new Expand({
      view: mapView,
      content: legend,
      expandIcon: "legend",
      expandTooltip: "Show legend",
      collapseTooltip: "Hide legend",
    });
    mapView.ui.add(legendExpand, "bottom-left");
    const search = new Search({
      view: mapView,
      includeDefaultSources: true,
      allPlaceholder: "Search for an address or place",
      popupEnabled: false,
    });
    mapView.ui.add(search, "top-right");
    const clickHandle = mapView.on("click", async (event) => {
      try {
        const response = await mapView.hitTest(event, { include: layer });
        const hits = response.results.filter(
          (result): result is GraphicHit =>
            result.type === "graphic" && Boolean(result.graphic),
        );
        const graphics = hits.map(({ graphic }) => {
          graphic.popupTemplate = parcelPopup;
          return graphic;
        });
        if (graphics.length === 0) {
          await mapView.closePopup();
          return;
        }
        const propertyNumber = graphics[0].attributes?.propNumber;
        if (propertyNumber !== null && propertyNumber !== undefined) {
          window.dispatchEvent(
            new CustomEvent("tailte:show-report", {
              detail: { propertyNumber: String(propertyNumber), open: false },
            }),
          );
        }
        await mapView.openPopup({
          features: graphics,
          location: event.mapPoint,
        });
      } catch (error) {
        console.error("Failed to open parcel popup", error);
      }
    });

    mapView.when(
      () => setMapReady(true),
      (error: unknown) => {
        console.error("Failed to initialize the map view", error);
        setMapError("The map view could not be initialized.");
      },
    );
    layer
      .load()
      .then(() => setMapError(null))
      .catch((error: unknown) => {
        console.error("Failed to load the Tailte Éireann parcel layer", error);
        setMapError(
          `The parcel layer could not be loaded: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      });
    mapView.whenLayerView(layer).catch((error: unknown) => {
      console.error("Failed to create the parcel layer view", error);
      setMapError(
        `The parcel layer could not be displayed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    });

    return () => {
      mapView.destroy();
      layerListExpand.destroy();
      layerList.destroy();
      basemapGalleryExpand.destroy();
      basemapGallery.destroy();
      legendExpand.destroy();
      legend.destroy();
      search.destroy();
      clickHandle.remove();
      parcelLayer.current = null;
    };
  }, [appliedFilter]);

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilter({
      localAuthority: localAuthorityFilter.trim(),
      category: categoryFilter.trim(),
    });
  };

  const clearFilter = () => {
    setLocalAuthorityFilter("");
    setCategoryFilter("");
    setAppliedFilter({ localAuthority: "", category: "" });
  };

  return (
    <main className="app">
      <header className="app__header">
        <a className="app__logo" href="https://tailte.ie" title="Tailte Éireann">
          <img
            src="https://tailte.ie/wp-content/uploads/2025/04/Tailte-Eireann-Colour.png"
            alt="Tailte Éireann"
          />
        </a>
        <nav className="app__nav" aria-label="Main navigation">
          <a href="https://tailte.ie/services/">Services</a>
          <a href="https://tailte.ie/resources/">Resources</a>
          <a href="https://tailte.ie/about/">About us</a>
          <a href="https://tailte.ie/contact-us/">Contact us</a>
        </nav>
        <div className="app__title">
          <p className="app__eyebrow">Valuation services</p>
          <h1>Irish valuation list</h1>
        </div>
        <div className="header-filter">
          <button
            className="header-filter__toggle"
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            aria-controls="valuation-filter"
          >
            Filter properties
          </button>
          {filterOpen && (
            <form
              id="valuation-filter"
              className="header-filter__panel"
              onSubmit={applyFilter}
            >
              <h2>Filter valuation list</h2>
              <label>
                Local authority
                <select
                  value={localAuthorityFilter}
                  onChange={(event) => setLocalAuthorityFilter(event.target.value)}
                >
                  <option value="">All local authorities</option>
                  {localAuthorities.map(([name, code]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Valuation category / subcategory
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="">All categories</option>
                  {valuationCategories.map(([name, code]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="header-filter__actions">
                <button type="submit">Apply filter</button>
                <button type="button" onClick={clearFilter}>
                  Clear
                </button>
              </div>
              <p className="header-filter__hint">
                Choose names to filter the properties shown on the map.
              </p>
            </form>
          )}
        </div>
      </header>
      <section className="app__map-shell" aria-label="Irish parcel map">
          <div ref={mapElement} className="app__map" />
          <div className="map-attribution">
            Parcel tiles: Tailte Éireann · Basemap: Esri Topographic
          </div>
          <aside className={`report-sidebar${reportOpen ? " report-sidebar--open" : ""}`}>
            <button
              className="report-sidebar__toggle"
              type="button"
              onClick={() => setReportOpen((open) => !open)}
              aria-expanded={reportOpen}
              aria-controls="valuation-report"
            >
              {reportOpen ? "Hide report" : "Show report"}
            </button>
            {reportOpen && (
              <div id="valuation-report" className="report-sidebar__content">
                <div className="report-sidebar__header">
                  <h2>Valuation report</h2>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    aria-label="Close valuation report"
                  >
                    ×
                  </button>
                </div>
                {reportLoading && <p>Loading valuation report…</p>}
                {reportError && <p className="auth-card__error">{reportError}</p>}
                {!reportLoading && !reportError && !reportProperty && (
                  <p>Select a property first.</p>
                )}
                {reportProperty && (
                  <>
                    <h3>Property {reportProperty.PropertyNumber}</h3>
                    <p>
                      {reportProperty.LocalAuthority} · {reportProperty.Category}
                    </p>
                    <p>
                      {[reportProperty.Address1, reportProperty.Address2, reportProperty.Address3, reportProperty.Eircode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <table className="parcel-report__table">
                      <thead>
                        <tr>
                          <th>Level</th>
                          <th>Use</th>
                          <th>Area</th>
                          <th>NAV/m²</th>
                          <th>NAV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportProperty.ValuationReport ?? []).map((item) => (
                          <tr key={`${item.Level}-${item.FloorUse}`}>
                            <td>{item.Level}</td>
                            <td>{item.FloorUse}</td>
                            <td>{item.Area} m²</td>
                            <td>{formatCurrency(item.NavPerM2)}</td>
                            <td>{formatCurrency(item.Nav)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      Additional items: {formatCurrency(reportProperty.AdditionalItems)}
                      <br />
                      Rateable valuation: {formatCurrency(reportProperty.Valuation)}
                    </p>
                    <p>
                      Published: {reportProperty.PublicationDate}
                      <br />
                      Valuation date: {reportProperty.ValuationDate}
                    </p>
                  </>
                )}
              </div>
            )}
          </aside>
          {mapError && <p className="map-error">{mapError}</p>}
          {!mapReady && !mapError && (
            <p className="map-loading">Loading map…</p>
          )}
      </section>
      <footer className="app__footer">
        <div className="app__footer-main">
          <img
            src="https://tailte.ie/wp-content/uploads/2025/04/Tailte-Eireann-Colour.png"
            alt="Tailte Éireann"
          />
          <nav aria-label="Footer navigation">
            <a href="https://tailte.ie/services/">Services</a>
            <a href="https://tailte.ie/resources/">Resources</a>
            <a href="https://tailte.ie/map-shop/">Map shop</a>
            <a href="https://tailte.ie/our-archives/">Our archives</a>
            <a href="https://tailte.ie/careers/">Careers</a>
            <a href="https://tailte.ie/contact-us/">Contact us</a>
          </nav>
          <p>
            We provide a property registration system, property valuation service,
            and national mapping and surveying infrastructure for the State.
          </p>
        </div>
        <div className="app__footer-terms">
          <a href="https://tailte.ie/data-sharing/">Data sharing</a>
          <a href="https://tailte.ie/privacy-notice/">Privacy notice</a>
          <a href="https://tailte.ie/accessibility-statement/">Accessibility</a>
          <span>© Tailte Éireann</span>
        </div>
      </footer>
    </main>
  );
}
