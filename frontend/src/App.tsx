import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import L, { type LatLngExpression } from 'leaflet'

type SalonSummary = {
  id: string
  name: string
  district: string | null
  rating: number | null
  review_count: number | null
  price_range?: string | null
  latitude: number | null
  longitude: number | null
}

type Salon = {
  id: string
  name: string
  address: string | null
  district: string | null
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  latitude: number | null
  longitude: number | null
  source: string | null
  services?: string[] | null
  price_range?: string | null
  notes?: string | null
}

type SalonForm = {
  name: string
  address: string
  district: string
  phone: string
  website: string
  rating: string
  review_count: string
  price_range: string
  services: string
  notes: string
}

const defaultCenter: LatLngExpression = [52.2297, 21.0122]
const adminTokenStorageKey = 'warsaw-salon-admin-token'

function createFormFromSalon(salon: Salon): SalonForm {
  return {
    name: salon.name ?? '',
    address: salon.address ?? '',
    district: salon.district ?? '',
    phone: salon.phone ?? '',
    website: salon.website ?? '',
    rating: salon.rating?.toString() ?? '',
    review_count: salon.review_count?.toString() ?? '',
    price_range: salon.price_range ?? '',
    services: salon.services?.join(', ') ?? '',
    notes: salon.notes ?? '',
  }
}

function App() {
  const [salons, setSalons] = useState<SalonSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null)
  const [search, setSearch] = useState('')
  const [district, setDistrict] = useState('')
  const [minRating, setMinRating] = useState('')
  const [minReviewCount, setMinReviewCount] = useState('')
  const [hasWebsite, setHasWebsite] = useState('all')
  const [sortBy, setSortBy] = useState('name_asc')
  const deferredSearch = useDeferredValue(search)
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [adminInput, setAdminInput] = useState('')
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [form, setForm] = useState<SalonForm>({
    name: '',
    address: '',
    district: '',
    phone: '',
    website: '',
    rating: '',
    review_count: '',
    price_range: '',
    services: '',
    notes: '',
  })
  const mapNodeRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const selectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const savedToken = window.localStorage.getItem(adminTokenStorageKey)
    if (!savedToken) {
      return
    }

    verifyAdminToken(savedToken).then((isValid) => {
      if (isValid) {
        setAdminToken(savedToken)
        setAdminInput(savedToken)
        setIsAdmin(true)
        setAuthMessage('Admin mode enabled.')
      } else {
        window.localStorage.removeItem(adminTokenStorageKey)
      }
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadSalons() {
      setListLoading(true)
      setError('')

      const params = new URLSearchParams()
      if (district) {
        params.set('district', district)
      }
      if (deferredSearch.trim()) {
        params.set('search', deferredSearch.trim())
      }
      if (minRating) {
        params.set('min_rating', minRating)
      }
      if (minReviewCount) {
        params.set('min_review_count', minReviewCount)
      }
      if (hasWebsite === 'true') {
        params.set('has_website', 'true')
      }
      params.set('sort_by', sortBy)

      const url = params.toString() ? `/api/salons?${params.toString()}` : '/api/salons'

      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error('Could not load salons')
        }

        const data: SalonSummary[] = await response.json()
        startTransition(() => {
          setSalons(data)
        })

        if (data.length === 0) {
          setSelectedId(null)
          setSelectedSalon(null)
          setEditMode(false)
          return
        }

        const currentSelectedId = selectedIdRef.current
        if (!currentSelectedId || !data.some((salon) => salon.id === currentSelectedId)) {
          setSelectedId(data[0].id)
        }
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setError('Could not load the salon list. Make sure the FastAPI backend is running.')
        }
      } finally {
        setListLoading(false)
      }
    }

    loadSalons()

    return () => controller.abort()
  }, [district, deferredSearch, minRating, minReviewCount, hasWebsite, sortBy])

  useEffect(() => {
    if (!selectedId) {
      return
    }

    const controller = new AbortController()

    async function loadSalonDetails() {
      setDetailLoading(true)
      setSaveMessage('')
      setEditMode(false)

      try {
        const response = await fetch(`/api/salons/${selectedId}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Could not load salon details')
        }

        const data: Salon = await response.json()
        setSelectedSalon(data)
        setForm(createFormFromSalon(data))
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setError('Could not load the selected salon.')
        }
      } finally {
        setDetailLoading(false)
      }
    }

    loadSalonDetails()

    return () => controller.abort()
  }, [selectedId])

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) {
      return
    }

    const mapContainer = mapNodeRef.current as HTMLDivElement & { _leaflet_id?: number }
    if (mapContainer._leaflet_id) {
      mapContainer._leaflet_id = undefined
    }

    const map = L.map(mapContainer, {
      zoomControl: true,
    }).setView(defaultCenter, 11)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    markerLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current

    if (!map || !markerLayer) {
      return
    }

    markerLayer.clearLayers()

    const mappableSalons = salons.filter(
      (salon): salon is SalonSummary & { latitude: number; longitude: number } =>
        salon.latitude !== null && salon.longitude !== null,
    )

    const points: L.LatLngTuple[] = []

    for (const salon of mappableSalons) {
      const point: L.LatLngTuple = [salon.latitude, salon.longitude]
      points.push(point)

      const isSelected = salon.id === selectedId
      const marker = L.circleMarker(point, {
        radius: isSelected ? 9 : 6,
        color: isSelected ? '#cf5b32' : '#1c5c48',
        weight: 2,
        fillColor: isSelected ? '#eb8b54' : '#2e8b6c',
        fillOpacity: 0.85,
      })

      marker.bindPopup(`<strong>${salon.name}</strong><br>${salon.district || 'District not set'}`)
      marker.on('click', () => setSelectedId(salon.id))
      marker.addTo(markerLayer)
    }

    if (
      selectedSalon?.latitude !== null &&
      selectedSalon?.latitude !== undefined &&
      selectedSalon?.longitude !== null &&
      selectedSalon?.longitude !== undefined
    ) {
      map.flyTo([selectedSalon.latitude, selectedSalon.longitude], 14, { duration: 0.8 })
      return
    }

    if (points.length === 0) {
      map.setView(defaultCenter, 11)
      return
    }

    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }

    map.fitBounds(L.latLngBounds(points), { padding: [32, 32] })
  }, [salons, selectedId, selectedSalon])

  async function verifyAdminToken(token: string) {
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'X-Admin-Token': token,
      },
    })
    return response.ok
  }

  async function handleAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = adminInput.trim()
    if (!token) {
      setAuthMessage('Enter the admin token first.')
      return
    }

    setAuthLoading(true)
    setAuthMessage('')

    try {
      const isValid = await verifyAdminToken(token)
      if (!isValid) {
        setIsAdmin(false)
        setAdminToken('')
        setAuthMessage('Admin token is invalid.')
        return
      }

      setAdminToken(token)
      setIsAdmin(true)
      setShowAdminForm(false)
      setAuthMessage('Admin mode enabled.')
      window.localStorage.setItem(adminTokenStorageKey, token)
    } catch {
      setAuthMessage('Could not verify the admin token.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleAdminLogout() {
    setIsAdmin(false)
    setEditMode(false)
    setAdminToken('')
    setAdminInput('')
    setAuthMessage('Admin mode disabled.')
    window.localStorage.removeItem(adminTokenStorageKey)
  }

  function updateForm(field: keyof SalonForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function startEdit() {
    if (!selectedSalon) {
      return
    }
    setForm(createFormFromSalon(selectedSalon))
    setSaveMessage('')
    setEditMode(true)
  }

  function cancelEdit() {
    if (selectedSalon) {
      setForm(createFormFromSalon(selectedSalon))
    }
    setSaveMessage('')
    setEditMode(false)
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !adminToken) {
      return
    }

    setSaving(true)
    setSaveMessage('')
    setError('')

    const payload = {
      name: form.name || null,
      address: form.address || null,
      district: form.district || null,
      phone: form.phone || null,
      website: form.website || null,
      rating: form.rating ? Number(form.rating) : null,
      review_count: form.review_count ? Number(form.review_count) : null,
      price_range: form.price_range || null,
      services: form.services
        ? form.services
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      notes: form.notes || null,
    }

    try {
      const response = await fetch(`/api/salons/${selectedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken,
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        handleAdminLogout()
        setError('Admin session expired. Enter the token again.')
        return
      }

      if (!response.ok) {
        throw new Error('Could not save salon')
      }

      const updatedSalon: Salon = await response.json()
      setSelectedSalon(updatedSalon)
      setForm(createFormFromSalon(updatedSalon))
      setEditMode(false)
      setSaveMessage('Changes saved successfully.')
      setSalons((current) =>
        current.map((salon) =>
          salon.id === updatedSalon.id
            ? {
                ...salon,
                name: updatedSalon.name,
                district: updatedSalon.district,
                rating: updatedSalon.rating,
                review_count: updatedSalon.review_count,
                price_range: updatedSalon.price_range,
                latitude: updatedSalon.latitude,
                longitude: updatedSalon.longitude,
              }
            : salon,
        ),
      )
    } catch {
      setError('Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  const districts = Array.from(
    new Set(
      salons
        .map((salon) => salon.district)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const mappableCount = salons.filter(
    (salon) => salon.latitude !== null && salon.longitude !== null,
  ).length

  const websiteUrl =
    selectedSalon?.website && /^https?:\/\//i.test(selectedSalon.website)
      ? selectedSalon.website
      : null

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Warsaw Beauty Salon Explorer</p>
          <h1>Browse real salon data, compare neighborhoods, and inspect listings.</h1>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <span className="stat-value">{salons.length}</span>
            <span className="stat-label">visible salons</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{districts.length}</span>
            <span className="stat-label">districts in view</span>
          </div>
        </div>
      </header>

      <section className="admin-panel">
        <div className="admin-row">
          <div>
            <p className="panel-kicker">Admin mode</p>
            <h2>{isAdmin ? 'Editing unlocked' : 'Restricted editing'}</h2>
          </div>
          <div className="admin-actions">
            {isAdmin ? (
              <button type="button" className="ghost-button" onClick={handleAdminLogout}>
                Exit admin mode
              </button>
            ) : (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowAdminForm((current) => !current)}
              >
                Enter admin mode
              </button>
            )}
          </div>
        </div>

        {showAdminForm && !isAdmin ? (
          <form className="admin-inline" onSubmit={handleAdminLogin}>
            <input
              className="admin-token-input"
              type="password"
              value={adminInput}
              onChange={(event) => setAdminInput(event.target.value)}
              placeholder="Enter admin token"
            />
            <button type="submit" className="save-button" disabled={authLoading}>
              {authLoading ? 'Checking...' : 'Unlock editing'}
            </button>
          </form>
        ) : null}

        {authMessage ? (
          <p className={isAdmin ? 'status status-success' : 'status status-error'}>
            {authMessage}
          </p>
        ) : null}
      </section>

      <section className="map-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Map view</p>
            <h2>See every visible salon on the map</h2>
          </div>
          <span className="panel-badge">{mappableCount} mapped</span>
        </div>

        <div className="map-frame">
          <div ref={mapNodeRef} className="salon-map" />
        </div>
      </section>

      <main className="dashboard">
        <section className="list-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Discovery</p>
              <h2>Find the right salon fast</h2>
            </div>
            <span className="panel-badge">{isAdmin ? 'Admin on' : 'Read only'}</span>
          </div>

          <div className="filters">
            <label className="field">
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or address"
              />
            </label>

            <label className="field">
              <span>District</span>
              <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                <option value="">All districts</option>
                {districts.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Minimum rating</span>
              <select value={minRating} onChange={(event) => setMinRating(event.target.value)}>
                <option value="">Any rating</option>
                <option value="4.5">4.5+</option>
                <option value="4.0">4.0+</option>
                <option value="3.5">3.5+</option>
              </select>
            </label>

            <label className="field">
              <span>Minimum review count</span>
              <select
                value={minReviewCount}
                onChange={(event) => setMinReviewCount(event.target.value)}
              >
                <option value="">Any volume</option>
                <option value="10">10+</option>
                <option value="50">50+</option>
                <option value="100">100+</option>
              </select>
            </label>

            <label className="field">
              <span>Website</span>
              <select value={hasWebsite} onChange={(event) => setHasWebsite(event.target.value)}>
                <option value="all">All salons</option>
                <option value="true">Website only</option>
              </select>
            </label>

            <label className="field">
              <span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="name_asc">Name A-Z</option>
                <option value="rating_desc">Rating high to low</option>
                <option value="reviews_desc">Most reviewed</option>
              </select>
            </label>
          </div>

          {listLoading ? <p className="status">Loading salon list...</p> : null}
          {error ? <p className="status status-error">{error}</p> : null}

          <div className="salon-list">
            {salons.map((salon) => (
              <button
                key={salon.id}
                type="button"
                className={salon.id === selectedId ? 'salon-card active' : 'salon-card'}
                onClick={() => setSelectedId(salon.id)}
              >
                <div>
                  <h3>{salon.name}</h3>
                  <p>{salon.district || 'District not set'}</p>
                </div>
                <div className="salon-meta">
                  <span>{salon.rating ? `${salon.rating.toFixed(1)} star` : 'No rating'}</span>
                  <span>
                    {salon.review_count ? `${salon.review_count} reviews` : 'No reviews yet'}
                  </span>
                  <span>{salon.price_range || 'Price not set'}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Salon details</p>
              <h2>{selectedSalon?.name || 'Select a salon'}</h2>
            </div>
            {selectedSalon?.district ? (
              <span className="panel-badge panel-badge-soft">{selectedSalon.district}</span>
            ) : null}
          </div>

          {detailLoading ? <p className="status">Loading details...</p> : null}

          {selectedSalon ? (
            <>
              <div className="detail-grid">
                <article className="info-card">
                  <p className="info-label">Address</p>
                  <p>{selectedSalon.address || 'No address added yet'}</p>
                </article>
                <article className="info-card">
                  <p className="info-label">Phone</p>
                  <p>{selectedSalon.phone || 'No phone number'}</p>
                </article>
                <article className="info-card">
                  <p className="info-label">Website</p>
                  {websiteUrl ? (
                    <p className="truncate">
                      <a
                        className="website-link"
                        href={websiteUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {selectedSalon.website}
                      </a>
                    </p>
                  ) : (
                    <p className="truncate">{selectedSalon.website || 'No website'}</p>
                  )}
                </article>
                <article className="info-card">
                  <p className="info-label">Source</p>
                  <p>{selectedSalon.source || 'Manual entry'}</p>
                </article>
                <article className="info-card">
                  <p className="info-label">Rating</p>
                  <p>
                    {selectedSalon.rating ? `${selectedSalon.rating.toFixed(1)} star` : 'No rating'}
                  </p>
                </article>
                <article className="info-card">
                  <p className="info-label">Reviews</p>
                  <p>{selectedSalon.review_count ?? 'No review count'}</p>
                </article>
                <article className="info-card">
                  <p className="info-label">Price range</p>
                  <p>{selectedSalon.price_range || 'Not set'}</p>
                </article>
                <article className="info-card">
                  <p className="info-label">Services</p>
                  <p>{selectedSalon.services?.join(', ') || 'No services listed'}</p>
                </article>
              </div>

              <div className="detail-footer">
                {saveMessage ? <p className="status status-success">{saveMessage}</p> : null}
                {isAdmin ? (
                  editMode ? (
                    <button type="button" className="edit-button" onClick={cancelEdit}>
                      Cancel edit
                    </button>
                  ) : (
                    <button type="button" className="edit-button" onClick={startEdit}>
                      Edit salon
                    </button>
                  )
                ) : null}
              </div>

              {isAdmin && editMode ? (
                <form className="editor" onSubmit={handleSave}>
                  <div className="editor-grid">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={form.name}
                        onChange={(event) => updateForm('name', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>District</span>
                      <input
                        value={form.district}
                        onChange={(event) => updateForm('district', event.target.value)}
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Address</span>
                      <input
                        value={form.address}
                        onChange={(event) => updateForm('address', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Phone</span>
                      <input
                        value={form.phone}
                        onChange={(event) => updateForm('phone', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Website</span>
                      <input
                        value={form.website}
                        onChange={(event) => updateForm('website', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Rating</span>
                      <input
                        value={form.rating}
                        onChange={(event) => updateForm('rating', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Review count</span>
                      <input
                        value={form.review_count}
                        onChange={(event) => updateForm('review_count', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Price range</span>
                      <input
                        value={form.price_range}
                        onChange={(event) => updateForm('price_range', event.target.value)}
                        placeholder="budget, mid, premium"
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Services</span>
                      <input
                        value={form.services}
                        onChange={(event) => updateForm('services', event.target.value)}
                        placeholder="haircut, coloring, manicure"
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Notes</span>
                      <textarea
                        rows={4}
                        value={form.notes}
                        onChange={(event) => updateForm('notes', event.target.value)}
                        placeholder="Add a short note for the listing"
                      />
                    </label>
                  </div>

                  <div className="editor-footer">
                    <p className="status">Only admins with the token can save changes.</p>
                    <button type="submit" className="save-button" disabled={saving}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              ) : null}
            </>
          ) : (
            <p className="status">Pick a salon from the list to inspect it.</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
