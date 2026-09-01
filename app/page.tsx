"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clientCategories, type ClientMenuItem } from "./menu-data";
import {
  UPI_APPS,
  UPI_ID,
  createUpiQuery,
  createUpiUrl,
  type UpiApp,
} from "./payment-config";
import { buildUpiLaunchSteps, launchUpiSequence } from "./upi-launch";

type CartLine = {
  item: ClientMenuItem;
  quantity: number;
};

type CheckoutStep = "cart" | "details" | "payment";

type CustomerDetails = {
  name: string;
  phone: string;
  address: string;
};

type DeliveryLocation = {
  mapUrl: string;
  accuracy: number;
  latitude: string;
  longitude: string;
};

type LocationState = "idle" | "locating" | "ready" | "error";

type ReverseGeocodeResult = {
  displayName?: string;
};

const cartKey = (item: ClientMenuItem) => `${item.section}::${item.name}::${item.price}`;
const OWNER_WHATSAPP = "917209998677";

function Icon({ name }: { name: "pin" | "whatsapp" | "arrow" | "search" | "back" }) {
  const paths = {
    pin: <><path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></>,
    whatsapp: <><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8.5 7.7c.2-.5.4-.5.7-.5h.5l.8 1.8c.1.3 0 .5-.2.7l-.6.7c.8 1.6 1.9 2.6 3.5 3.3l.7-.8c.2-.2.4-.3.7-.1l1.7.8c.3.1.4.4.3.7-.2 1-1.3 1.7-2.3 1.7-2.1 0-4.5-1.6-6-3.5-1.2-1.5-2-3.3-1.4-4.6.3-.2.6-.2.6-.2Z"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    back: <><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Home() {
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState<ClientMenuItem | null>(null);
  const [basket, setBasket] = useState<CartLine[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("cart");
  const [customer, setCustomer] = useState<CustomerDetails>({ name: "", phone: "", address: "" });
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [upiLaunchStatus, setUpiLaunchStatus] = useState("");
  const cancelUpiLaunchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const clearStatus = () => {
      if (document.visibilityState === "visible") setUpiLaunchStatus("");
    };
    document.addEventListener("visibilitychange", clearStatus);
    return () => {
      document.removeEventListener("visibilitychange", clearStatus);
      cancelUpiLaunchRef.current?.();
    };
  }, []);
  const [proofReady, setProofReady] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [addressLookupUsed, setAddressLookupUsed] = useState(false);
  const addressValueRef = useRef("");
  const lastDetectedAddressRef = useRef("");
  const reverseGeocodeCacheRef = useRef(new Map<string, string>());
  const lastReverseGeocodeAtRef = useRef(0);
  const selected = clientCategories.find((category) => category.id === active);
  const visibleItems = useMemo(() => {
    if (!selected) return [];
    const needle = query.trim().toLowerCase();
    return needle ? selected.items.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(needle)) : selected.items;
  }, [query, selected]);
  const basketQuantity = basket.reduce((sum, line) => sum + line.quantity, 0);
  const basketTotal = basket.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0);
  const focusedQuantity = focused ? basket.find((line) => cartKey(line.item) === cartKey(focused))?.quantity ?? 0 : 0;
  const paymentOrderId = orderId || "CHAI-N-PANI";
  const upiQuery = createUpiQuery(basketTotal.toFixed(2), paymentOrderId);
  const upiUrl = createUpiUrl(upiQuery);
  const locationPreviewUrl = deliveryLocation
    ? `https://maps.google.com/maps?q=${deliveryLocation.latitude},${deliveryLocation.longitude}&z=17&output=embed`
    : "";
  const orderLines = basket.map(({ item, quantity }) => `${quantity} x ${item.name} — ₹${Number(item.price) * quantity}`).join("\n");
  const whatsappMessage = [
    `*New Chai N Pani Order — ${orderId}*`,
    "",
    orderLines,
    "----------------",
    `*Total: ₹${basketTotal}*`,
    "",
    `Name: ${customer.name.trim()}`,
    `Phone: +91 ${customer.phone.trim()}`,
    `Address (checked by customer): ${customer.address.trim()}`,
    `Google Maps pin: ${deliveryLocation?.mapUrl || "Not shared — use written address"}`,
    `GPS accuracy: ${deliveryLocation ? `about ${deliveryLocation.accuracy} metres` : "Not available"}`,
    "",
    `Paid to UPI: ${UPI_ID}`,
    `UPI reference/UTR: ${paymentReference.trim()}`,
    "",
    "PAYMENT PROOF: Please attach the payment screenshot to this chat before sending.",
    "The order is confirmed only after the restaurant verifies payment and delivery distance.",
  ].join("\n");
  const whatsappOrderUrl = `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(whatsappMessage)}`;
  const canSendOrder = paymentReference.trim().length >= 6 && proofReady;
  const checkoutStepIndex = checkoutStep === "cart" ? 0 : checkoutStep === "details" ? 1 : 2;

  const addToBasket = (item: ClientMenuItem) => {
    const key = cartKey(item);
    setPaymentReference("");
    setProofReady(false);
    setBasket((current) => {
      const existing = current.find((line) => cartKey(line.item) === key);
      if (!existing) return [...current, { item, quantity: 1 }];
      return current.map((line) => cartKey(line.item) === key ? { ...line, quantity: line.quantity + 1 } : line);
    });
  };

  const changeQuantity = (key: string, change: number) => {
    const currentLine = basket.find((line) => cartKey(line.item) === key);
    if (currentLine && currentLine.quantity + change <= 0 && basket.length === 1) setOrderOpen(false);
    setPaymentReference("");
    setProofReady(false);
    setBasket((current) => current
      .map((line) => cartKey(line.item) === key ? { ...line, quantity: line.quantity + change } : line)
      .filter((line) => line.quantity > 0));
  };

  const removeFromBasket = (key: string) => {
    if (basket.length === 1) setOrderOpen(false);
    setPaymentReference("");
    setProofReady(false);
    setBasket((current) => current.filter((line) => cartKey(line.item) !== key));
  };

  const openCart = () => {
    setCheckoutStep("cart");
    setCheckoutError("");
    setOrderOpen(true);
  };

  const requestCurrentLocation = () => {
    setCheckoutError("");
    if (!("geolocation" in navigator)) {
      setLocationState("error");
      setLocationMessage("GPS location is not supported on this device. Please enter the full address below.");
      return;
    }

    setLocationState("locating");
    setLocationMessage("Requesting your phone's location…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude.toFixed(6);
        const longitude = coords.longitude.toFixed(6);
        const accuracy = Math.max(1, Math.round(coords.accuracy));
        setDeliveryLocation({
          mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
          accuracy,
          latitude,
          longitude,
        });
        setLocationMessage(`GPS pin found (about ${accuracy} m accuracy). Finding the readable address…`);

        try {
          const cacheKey = `${latitude},${longitude}`;
          let detectedAddress = reverseGeocodeCacheRef.current.get(cacheKey) || "";

          if (!detectedAddress) {
            const waitMs = Math.max(0, 1000 - (Date.now() - lastReverseGeocodeAtRef.current));
            if (waitMs > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, waitMs));
            lastReverseGeocodeAtRef.current = Date.now();

            const response = await fetch("/api/reverse-geocode", {
              method: "POST",
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({ latitude, longitude }),
            });
            if (!response.ok) throw new Error("Address lookup failed");

            const result = await response.json() as ReverseGeocodeResult;
            detectedAddress = result.displayName?.trim() || "";
            if (!detectedAddress) throw new Error("No readable address found");
            reverseGeocodeCacheRef.current.set(cacheKey, detectedAddress);
          }

          const currentAddress = addressValueRef.current.trim();
          const previousAutoAddress = lastDetectedAddressRef.current.trim();
          const canAutofill = !currentAddress || currentAddress === previousAutoAddress;

          if (canAutofill) {
            addressValueRef.current = detectedAddress;
            setCustomer((current) => ({ ...current, address: detectedAddress }));
            setLocationMessage(`Address found from GPS (about ${accuracy} m accuracy). Check and edit it below before continuing.`);
            window.setTimeout(() => document.getElementById("delivery-address")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
          } else {
            setLocationMessage(`GPS pin updated (about ${accuracy} m accuracy). Your manually edited address was kept.`);
          }

          lastDetectedAddressRef.current = detectedAddress;
          setAddressLookupUsed(true);
          setLocationState("ready");
        } catch {
          setLocationState("ready");
          setLocationMessage(`GPS pin added (about ${accuracy} m accuracy), but the text address could not be found automatically. Please type or correct it below.`);
        }
      },
      (error) => {
        setDeliveryLocation(null);
        setLocationState("error");
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage("Location permission was denied. Allow location access in your browser, or enter the full address below.");
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage("GPS took too long to respond. Try again near a window, or enter the full address below.");
        } else {
          setLocationMessage("Your location could not be detected. Try again, or enter the full address below.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const clearGpsLocation = () => {
    setDeliveryLocation(null);
    setLocationState("idle");
    setLocationMessage("GPS pin removed. The restaurant will use your written address.");
  };

  const openUpiApp = (app: UpiApp) => {
    cancelUpiLaunchRef.current?.();

    const fallbackQuery = new URLSearchParams({
      app: app.id,
      amount: basketTotal.toFixed(2),
      order: paymentOrderId,
    });
    const fallbackUrl = `${window.location.origin}/upi-payment?${fallbackQuery.toString()}`;

    setUpiLaunchStatus(`Opening ${app.name}…`);

    cancelUpiLaunchRef.current = launchUpiSequence(
      buildUpiLaunchSteps(app, upiQuery),
      {
        onStep: (label) => setUpiLaunchStatus(label),
        onExhausted: () => {
          setUpiLaunchStatus("");
          cancelUpiLaunchRef.current = null;
          window.location.assign(fallbackUrl);
        },
      },
    );
  };

  const updatePhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const localNumber = digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits;
    setCustomer((current) => ({ ...current, phone: localNumber.slice(0, 10) }));
  };

  const updateAddress = (value: string) => {
    addressValueRef.current = value;
    setCustomer((current) => ({ ...current, address: value }));
  };

  const continueToPayment = () => {
    const phoneDigits = customer.phone.replace(/\D/g, "");
    const validPhone = phoneDigits.length === 10;
    if (customer.name.trim().length < 2) {
      setCheckoutError("Enter the customer name.");
      return;
    }
    if (!validPhone) {
      setCheckoutError("Enter a valid 10-digit Indian phone number.");
      return;
    }
    if (customer.address.trim().length < 8) {
      setCheckoutError("Enter the complete delivery address and landmark.");
      return;
    }
    if (!orderId) setOrderId(`CNP-${Date.now().toString().slice(-8)}`);
    setCheckoutError("");
    setCheckoutStep("payment");
  };

  const clearCart = () => {
    setBasket([]);
    setOrderOpen(false);
    setCheckoutStep("cart");
    setOrderId("");
    setDeliveryLocation(null);
    setLocationState("idle");
    setLocationMessage("");
    setPaymentReference("");
    setProofReady(false);
    setCheckoutError("");
  };

  const chooseCategory = (id: string) => {
    setActive(id);
    setQuery("");
    setFocused(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <button className={`round-button back-button ${selected ? "is-visible" : ""}`} aria-label="Back to categories" onClick={() => setActive(null)}><Icon name="back" /></button>
          <button className="brand" onClick={() => setActive(null)} aria-label="Chai N Pani home">
            <span className="brand-script">Chai N Pani</span>
            <span className="brand-tagline">Fresh food, made with heart</span>
          </button>
          <nav className="header-actions" aria-label="Restaurant links">
            <a className="round-button" href="https://maps.app.goo.gl/B18tZUCiTsggvhzk8" target="_blank" rel="noreferrer" aria-label="Open Chai N Pani in Google Maps"><Icon name="pin" /></a>
            <a className="round-button" href={`https://wa.me/${OWNER_WHATSAPP}`} target="_blank" rel="noreferrer" aria-label="Chat with Chai N Pani on WhatsApp"><Icon name="whatsapp" /></a>
            <span className="language-pill">EN <span aria-hidden="true">⌄</span></span>
          </nav>
        </div>
      </header>

      {!selected ? (
        <div className="home-shell page-enter">
          <section className="intro-row">
            <div><p className="eyebrow">Local delivery · Freshly prepared</p><h1>What are you<br /><em>craving?</em></h1></div>
            <p className="intro-copy">Pick a chapter of our menu. Every dish is prepared fresh, from comforting Indian main courses to Indo-Chinese favourites, quick bites and chilled drinks.</p>
          </section>

          <section className="category-grid" aria-label="Menu categories">
            {clientCategories.map((category, index) => (
              <button className={`category-card category-card-${index + 1}`} key={category.id} onClick={() => chooseCategory(category.id)}>
                <img src={category.cover} alt="" /><span className="category-overlay" />
                <span className="category-content">
                  <span className="category-number">0{index + 1}</span>
                  <span><span className="category-eyebrow">{category.eyebrow}</span><strong>{category.name}</strong><small>{category.description}</small></span>
                  <span className="category-arrow"><Icon name="arrow" /></span>
                </span>
              </button>
            ))}
          </section>
          <footer className="home-footer"><span>CHAI N PANI © 2026</span><span>Made for good company.</span></footer>
        </div>
      ) : (
        <div className="menu-shell page-enter">
          <section className="menu-heading">
            <div><p className="eyebrow">{selected.eyebrow}</p><h1>{selected.name}</h1><p>{selected.description}</p></div>
            <div className="search-wrap"><Icon name="search" /><input aria-label="Search this category" placeholder="Search the menu" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          </section>

          <nav className="category-tabs" aria-label="Choose a menu category">
            {clientCategories.map((category) => <button key={category.id} className={category.id === selected.id ? "active" : ""} onClick={() => chooseCategory(category.id)}>{category.name}</button>)}
          </nav>

          <section className="menu-grid" aria-live="polite">
            {visibleItems.map((item) => (
              <button className="menu-card" key={item.name} onClick={() => setFocused(item)} aria-label={`View ${item.name} details`} aria-haspopup="dialog">
                <div className="item-image-wrap">{item.image ? <img src={item.image} alt={item.name} loading="lazy" decoding="async" /> : <div className="photo-placeholder" role="img" aria-label={`${item.name} photo coming soon`}><span>Owner photo</span><strong>Coming soon</strong></div>}{item.tag && <span className="item-tag">{item.tag}</span>}</div>
                <div className="item-copy">
                  <div className="item-title-row"><h2>{item.name}</h2><strong>₹ {item.price}</strong></div>
                  <p>{item.description}</p>
                  <div className="item-meta"><span>{item.section}</span><span>Freshly prepared</span></div>
                </div>
              </button>
            ))}
            {visibleItems.length === 0 && <div className="empty-state"><span>Nothing matched “{query}”.</span><button onClick={() => setQuery("")}>Clear search</button></div>}
          </section>
        </div>
      )}

      {focused && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setFocused(null)}>
          <section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="item-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setFocused(null)} aria-label="Close item details">×</button>
            <div className="modal-image">{focused.image ? <img src={focused.image} alt={focused.name} /> : <div className="photo-placeholder" role="img" aria-label={`${focused.name} photo coming soon`}><span>Owner photo</span><strong>Coming soon</strong></div>}{focused.tag && <span className="item-tag">{focused.tag}</span>}</div>
            <div className="modal-copy">
              <p className="eyebrow">Chai N Pani selection</p>
              <h2 id="item-modal-title">{focused.name}</h2>
              <p>{focused.description}</p>
              <div className="modal-meta">
                <span>{focused.section}</span>
                {focused.tag && <span>{focused.tag}</span>}
                <span>Prepared fresh</span>
              </div>
              <button className="add-button" onClick={() => { addToBasket(focused); setFocused(null); }}>
                <span>{focusedQuantity > 0 ? `Add another · ${focusedQuantity} in cart` : "Add to cart"}</span><strong>₹ {focused.price}</strong>
              </button>
            </div>
          </section>
        </div>
      )}

      {basketQuantity > 0 && (
        <button className="order-bar" onClick={openCart} aria-label="Review cart" aria-haspopup="dialog">
          <span className="order-count" aria-live="polite">{basketQuantity}</span>
          <span>View cart</span>
          <strong>₹ {basketTotal}</strong>
        </button>
      )}

      {orderOpen && (
        <div className="modal-backdrop order-backdrop" role="presentation" onMouseDown={() => setOrderOpen(false)}>
          <aside className="order-sheet" role="dialog" aria-modal="true" aria-labelledby="order-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOrderOpen(false)} aria-label="Close cart">×</button>
            <nav className="checkout-progress" aria-label="Checkout progress">
              {["Cart", "Delivery", "Payment"].map((label, index) => (
                <div className={`checkout-progress-step ${index === checkoutStepIndex ? "active" : ""} ${index < checkoutStepIndex ? "complete" : ""}`} key={label} aria-current={index === checkoutStepIndex ? "step" : undefined}>
                  <b>{index < checkoutStepIndex ? "✓" : index + 1}</b>
                  <span>{label}</span>
                </div>
              ))}
            </nav>
            {checkoutStep === "cart" && (
              <div className="checkout-step">
                <p className="eyebrow">Your selection</p>
                <div className="cart-title-row">
                  <h2 id="order-title">Your cart</h2>
                  <span>{basketQuantity} {basketQuantity === 1 ? "item" : "items"}</span>
                </div>
                <p className="order-note">Use + and − to change each dish, or remove one separately.</p>
                <div className="order-items">
                  {basket.map(({ item, quantity }) => {
                    const key = cartKey(item);
                    const lineTotal = Number(item.price) * quantity;
                    return (
                      <div className="order-item" key={key}>
                        <div className="order-item-main">
                          <div className="order-item-image">
                            {item.image ? <img src={item.image} alt="" /> : <span>{item.name.charAt(0)}</span>}
                          </div>
                          <div className="order-item-copy">
                            <span className="order-item-name">{item.name}</span>
                            <small>₹ {item.price} each · freshly prepared</small>
                            <button className="remove-item" onClick={() => removeFromBasket(key)} aria-label={`Remove ${item.name} from cart`}>Remove</button>
                          </div>
                        </div>
                        <div className="order-item-actions">
                          <div className="quantity-control" aria-label={`Quantity for ${item.name}`}>
                            <button onClick={() => changeQuantity(key, -1)} aria-label={`Remove one ${item.name}`}>−</button>
                            <span aria-live="polite">{quantity}</span>
                            <button onClick={() => changeQuantity(key, 1)} aria-label={`Add one more ${item.name}`}>+</button>
                          </div>
                          <strong className="order-line-total">₹ {lineTotal}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="cart-summary">
                  <div><span>Food subtotal</span><strong>₹ {basketTotal}</strong></div>
                  <div><span>Delivery charge</span><strong className="summary-note">Confirmed on WhatsApp</strong></div>
                  <div className="cart-summary-total"><span>Total before delivery</span><strong>₹ {basketTotal}</strong></div>
                </div>
                <button className="checkout-primary" onClick={() => { setCheckoutError(""); setCheckoutStep("details"); }}>Continue to delivery</button>
                <div className="cart-actions">
                  <button className="continue-button" onClick={() => setOrderOpen(false)}>Add more dishes</button>
                  <button className="clear-button" onClick={clearCart}>Clear cart</button>
                </div>
              </div>
            )}

            {checkoutStep === "details" && (
              <div className="checkout-step">
                <button className="checkout-back" onClick={() => { setCheckoutError(""); setCheckoutStep("cart"); }}>← Back to cart</button>
                <p className="eyebrow">Delivery details</p>
                <h2 id="order-title">Where should it go?</h2>
                <p className="order-note">Delivery is available within approximately 4 km. The restaurant confirms the address on WhatsApp.</p>
                <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); continueToPayment(); }}>
                  <label>
                    <span>Customer name</span>
                    <input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" placeholder="Your full name" required />
                  </label>
                  <label>
                    <span>Phone number</span>
                    <div className="phone-field">
                      <span className="country-code">+91</span>
                      <input value={customer.phone} onChange={(event) => updatePhone(event.target.value)} autoComplete="tel" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" placeholder="10-digit mobile number" aria-label="10-digit Indian mobile number" required />
                    </div>
                    <small className="field-helper">Enter the 10-digit number only. The +91 country code is added automatically.</small>
                  </label>
                  <div className={`location-capture location-${locationState}`}>
                    <div className="location-copy">
                      <strong>Use GPS to fill my address</strong>
                      <span>Each tap sends your coordinates once to OpenStreetMap’s address lookup. It suggests readable text that you can check and edit before the order is sent.</span>
                    </div>
                    <button className="location-button" type="button" onClick={requestCurrentLocation} disabled={locationState === "locating"}>
                      <Icon name="pin" />
                      <span>{locationState === "locating" ? "Finding location…" : deliveryLocation ? "Update my location" : "Use my current location"}</span>
                    </button>
                    {locationMessage && (
                      <p className="location-status" aria-live="polite">
                        {locationMessage}
                        {deliveryLocation && <> <a href={deliveryLocation.mapUrl} target="_blank" rel="noreferrer">View pin</a></>}
                      </p>
                    )}
                    {deliveryLocation && (
                      <div className="location-preview">
                        <iframe src={locationPreviewUrl} title="Detected delivery location" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                        <div>
                          <span>GPS pin · about {deliveryLocation.accuracy} m accuracy</span>
                          <span className="location-preview-actions">
                            <a href={deliveryLocation.mapUrl} target="_blank" rel="noreferrer">Open map</a>
                            <button type="button" onClick={clearGpsLocation}>Use address only</button>
                          </span>
                        </div>
                      </div>
                    )}
                    {addressLookupUsed && customer.address.trim() && (
                      <div className="detected-address-card" aria-live="polite">
                        <span>Address that will be sent</span>
                        <strong>{customer.address}</strong>
                        <button type="button" onClick={() => document.getElementById("delivery-address")?.focus()}>Check or edit this address</button>
                        <small>GPS can choose a nearby building. Add your house/flat number and landmark if needed.</small>
                      </div>
                    )}
                    {addressLookupUsed && (
                      <p className="map-attribution">Address suggestion © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
                    )}
                  </div>
                  <div className="address-divider"><span>then check or type the address</span></div>
                  <label>
                    <span>Delivery address — check and edit</span>
                    <textarea id="delivery-address" value={customer.address} onChange={(event) => updateAddress(event.target.value)} autoComplete="street-address" placeholder="House/flat, road, area and nearby landmark" rows={4} required />
                    <small className="field-helper">Enter the full house/flat number, road, area and nearby landmark. This editable text and the GPS pin are both sent to the owner.</small>
                  </label>
                  {checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}
                  <button className="checkout-primary" type="submit">Continue to payment · ₹ {basketTotal}</button>
                </form>
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="checkout-step payment-step">
                <button className="checkout-back" onClick={() => { setCheckoutError(""); setCheckoutStep("details"); }}>← Back to details</button>
                <p className="eyebrow">Secure UPI payment</p>
                <h2 id="order-title">Pay ₹ {basketTotal}</h2>
                <div className="payment-summary">
                  <span>Order ID</span><strong>{orderId}</strong>
                  <span>Payee UPI</span><strong>{UPI_ID}</strong>
                </div>

                <div className="upi-app-grid" aria-label="Choose a UPI payment app">
                  {UPI_APPS.map((app) => (
                    <button className={`upi-app-button upi-${app.id}`} type="button" onClick={() => openUpiApp(app)} key={app.id}>
                      <span className="upi-app-logo-wrap"><img className="upi-app-logo" src={app.logo} alt={`${app.name} logo`} /></span>
                      <span className="upi-app-copy"><strong>Pay with {app.name}</strong><small>₹ {basketTotal} will be prefilled</small></span>
                      <span className="upi-app-arrow" aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
                {upiLaunchStatus && <p className="upi-launch-status" aria-live="polite">{upiLaunchStatus}</p>}
                <a className="upi-any-button" href={upiUrl}>Use any other UPI app · ₹ {basketTotal}</a>
                <p className="payment-footnote">Each branded button targets the selected app first, then that app’s own link, then your phone’s UPI chooser. The amount, payee and order reference stay prefilled throughout, and the retry page only appears if every attempt fails.</p>

                <div className="payment-divider"><span>or scan to pay</span></div>
                <div className="qr-payment-card">
                  <img src="/payment/chai-n-pani-upi-qr.png" alt={`UPI QR code for ${UPI_ID}`} />
                  <div>
                    <strong>Scan with any UPI app</strong>
                    <span>Enter exactly ₹ {basketTotal}</span>
                    <small>UPI ID: {UPI_ID}</small>
                  </div>
                </div>

                <label className="payment-reference-field">
                  <span>UPI transaction/reference number</span>
                  <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value.replace(/[^a-zA-Z0-9]/g, ""))} inputMode="numeric" placeholder="Usually 12 digits" autoComplete="off" />
                </label>

                <label className="proof-check">
                  <input type="checkbox" checked={proofReady} onChange={(event) => setProofReady(event.target.checked)} />
                  <span>I have taken the payment-success screenshot and will attach it in WhatsApp.</span>
                </label>

                <div className="proof-warning">
                  <strong>Attach proof before sending</strong>
                  <span>WhatsApp opens with the order, edited address and clickable map pin already typed. Attach the payment screenshot and tap Send; the owner receives a normal WhatsApp message and notification.</span>
                </div>

                <button className="whatsapp-order-button" disabled={!canSendOrder} onClick={() => window.open(whatsappOrderUrl, "_blank", "noopener,noreferrer")}>
                  <Icon name="whatsapp" />
                  <span>Send order on WhatsApp</span>
                </button>
                {!canSendOrder && <p className="whatsapp-helper">Enter the UPI reference and confirm the screenshot is ready.</p>}
                <p className="payment-footnote">Payment is manually checked by Chai N Pani. The order is not confirmed until the owner replies on WhatsApp.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
