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
import {
  checkArcgisSignIn,
  signInToArcgis,
  signOutOfArcgis,
  type ArcgisUser,
} from "./utils/arcgisOnline.js";

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
  ["Carlow County Council", "0150"],
  ["Cavan County Council", "0250"],
  ["Clare County Council", "0350"],
  ["Cork City Council", "0402"],
  ["Cork County Council", "0450"],
  ["Donegal County Council", "0550"],
  // The first four digits of the valuation roll number identify the authority.
  ["Dublin City Council", "0602"],
  ["Dún Laoghaire-Rathdown County Council", "0629"],
  ["Fingal County Council", "0628"],
  ["Galway City Council", "0702"],
  ["Galway County Council", "0750"],
  ["Kerry County Council", "0850"],
  ["Kildare County Council", "0950"],
  ["Kilkenny County Council", "1050"],
  ["Laois County Council", "1150"],
  ["Leitrim County Council", "1250"],
  ["Limerick City and County Council", "1350"],
  ["Longford County Council", "1450"],
  ["Louth County Council", "1550"],
  ["Mayo County Council", "1650"],
  ["Meath County Council", "1750"],
  ["Monaghan County Council", "1850"],
  ["Offaly County Council", "1950"],
  ["Roscommon County Council", "2001"],
  ["Sligo County Council", "2150"],
  ["South Dublin County Council", "0630"],
  ["Tipperary County Council", "2850"],
  ["Waterford City and County Council", "2450"],
  ["Westmeath County Council", "2550"],
  ["Wexford County Council", "2650"],
  ["Wicklow County Council", "2750"],
] as const;

const authorityMapViews: Record<
  string,
  { center: [number, number]; zoom: number }
> = {
  "0150": { center: [-6.93, 52.84], zoom: 10 },
  "0250": { center: [-7.36, 53.99], zoom: 10 },
  "0350": { center: [-8.98, 52.84], zoom: 10 },
  "0402": { center: [-8.47, 51.9], zoom: 11 },
  "0450": { center: [-8.5, 51.95], zoom: 9 },
  "0550": { center: [-8.1, 54.95], zoom: 9 },
  "0602": { center: [-6.27, 53.35], zoom: 12 },
  "0628": { center: [-6.4, 53.5], zoom: 11 },
  "0629": { center: [-6.17, 53.27], zoom: 11 },
  "0630": { center: [-6.4, 53.29], zoom: 11 },
  "0702": { center: [-9.05, 53.27], zoom: 11 },
  "0750": { center: [-8.8, 53.35], zoom: 9 },
  "0850": { center: [-9.7, 52.15], zoom: 9 },
  "0950": { center: [-6.82, 53.16], zoom: 10 },
  "1050": { center: [-7.25, 52.65], zoom: 10 },
  "1150": { center: [-7.3, 53], zoom: 10 },
  "1250": { center: [-8, 54], zoom: 10 },
  "1350": { center: [-8.63, 52.66], zoom: 10 },
  "1450": { center: [-7.8, 53.73], zoom: 10 },
  "1550": { center: [-6.4, 53.95], zoom: 10 },
  "1650": { center: [-9.3, 53.9], zoom: 9 },
  "1750": { center: [-6.7, 53.6], zoom: 10 },
  "1850": { center: [-6.97, 54.25], zoom: 10 },
  "1950": { center: [-7.7, 53.25], zoom: 10 },
  "2001": { center: [-8.2, 53.63], zoom: 10 },
  "2150": { center: [-8.47, 54.27], zoom: 10 },
  "2450": { center: [-7.11, 52.26], zoom: 10 },
  "2550": { center: [-7.5, 53.5], zoom: 10 },
  "2650": { center: [-6.6, 52.34], zoom: 10 },
  "2750": { center: [-6.4, 52.98], zoom: 10 },
  "2850": { center: [-8, 52.55], zoom: 9 },
};

const valuationCategories = [
  {
    name: "Commercial",
    subcategories: [
      ["Office", "105"],
      ["Retail", "374"],
      ["Industrial", "183"],
      ["Hotel and guest accommodation", "395"],
    ],
  },
  {
    name: "Other property",
    subcategories: [
      ["Residential", "231"],
      ["Agricultural", "751"],
      ["Health and community", "111"],
      ["Other property use", "108"],
    ],
  },
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
  categoryCodes: string[];
  subcategory: string;
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
    ...(filter.localAuthority || filter.categoryCodes.length || filter.subcategory
      ? {
          filter: [
            "all",
            ...(filter.localAuthority
              ? [
                  [
                    "==",
                    ["slice", ["to-string", ["get", "rollNumber"]], 0, 4],
                    filter.localAuthority,
                  ],
                ]
              : []),
            ...(filter.categoryCodes.length
              ? [["in", ["get", "catUseCode"], ["literal", filter.categoryCodes]]]
              : []),
            ...(filter.subcategory
              ? [["==", ["get", "catUseCode"], filter.subcategory]]
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
  const [arcgisUser, setArcgisUser] = useState<ArcgisUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [localAuthorityFilter, setLocalAuthorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState({
    localAuthority: "",
    categoryCodes: [] as string[],
    subcategory: "",
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
      () => {
        setMapReady(true);
        const authorityView = authorityMapViews[appliedFilter.localAuthority];
        if (authorityView) {
          mapView.goTo(authorityView).catch((error: unknown) => {
            console.error("Failed to zoom to filtered authority", error);
          });
        }
      },
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
      categoryCodes:
        valuationCategories.find(({ name }) => name === categoryFilter)?.subcategories.map(
          ([, code]) => code,
        ) ?? [],
      subcategory: subcategoryFilter,
    });
  };

  const clearFilter = () => {
    setLocalAuthorityFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
    setAppliedFilter({
      localAuthority: "",
      categoryCodes: [],
      subcategory: "",
    });
  };

  useEffect(() => {
    checkArcgisSignIn()
      .then(setArcgisUser)
      .catch((error: unknown) => {
        console.error("Failed to check ArcGIS Online sign-in status", error);
        setAuthError("ArcGIS Online sign-in status could not be checked.");
      })
      .finally(() => setAuthChecking(false));
  }, []);

  const handleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      setArcgisUser(await signInToArcgis());
    } catch (error) {
      console.error("ArcGIS Online sign-in failed", error);
      setAuthError("ArcGIS Online sign-in failed. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = () => {
    signOutOfArcgis();
    setArcgisUser(null);
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
        <div className="app__auth">
          {authError && <span className="app__auth-error">{authError}</span>}
          {authChecking ? (
            <span>Checking sign-in…</span>
          ) : arcgisUser ? (
            <>
              <span title={arcgisUser.username}>
                Signed in as {arcgisUser.fullName}
              </span>
              <button type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" onClick={handleSignIn} disabled={authBusy}>
              {authBusy ? "Signing in…" : "Sign in to ArcGIS Online"}
            </button>
          )}
        </div>

      </header>
      <section className="app__map-shell" aria-label="Irish valuation list map">
          <div ref={mapElement} className="app__map" />
          <aside className={`filter-sidebar${filterOpen ? " filter-sidebar--open" : ""}`}>
            <button
              className="filter-sidebar__toggle"
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              aria-expanded={filterOpen}
              aria-controls="valuation-filter"
            >
              {filterOpen ? "Hide filters" : "Filter properties"}
            </button>
            {filterOpen && (
              <div id="valuation-filter" className="filter-sidebar__content">
                <div className="filter-sidebar__header">
                  <h2>Filter valuation list</h2>
                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    aria-label="Close property filters"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={applyFilter}>
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
                Valuation category
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setSubcategoryFilter("");
                  }}
                >
                  <option value="">All categories</option>
                  {valuationCategories.map(({ name }) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Valuation subcategory
                <select
                  value={subcategoryFilter}
                  onChange={(event) => setSubcategoryFilter(event.target.value)}
                  disabled={!categoryFilter}
                >
                  <option value="">
                    {categoryFilter
                      ? "All subcategories"
                      : "Select a category first"}
                  </option>
                  {valuationCategories
                    .find(({ name }) => name === categoryFilter)
                    ?.subcategories.map(([name, code]) => (
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
              </div>
            )}
          </aside>
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
