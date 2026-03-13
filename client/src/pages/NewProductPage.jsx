import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'

const CATEGORY_OPTIONS = {
  Automobil: ['Motor Oil', 'Car Cleaning Supplies', 'Air Fresheners', 'Windshield Washer Fluid', 'Car Accessories'],
  Beverage: ['Soft Drinks', 'Energy Drinks', 'Bottled Water', 'Juice & Juice Drinks', 'Sports Drinks', 'Iced Tea & Coffee', 'Alcoholic Beverages'],
  'Bio Botanicals': ['Kratom', 'Herbal Supplements', 'Botanical Extracts', 'Herbal Tea', '7OH'],
  'Chargers & Accessories': ['Phone Chargers', 'Charging Cables', 'Car Chargers', 'Power Banks', 'Earphones & Headphones', 'Phone Holders'],
  'Household Products': ['Cleaning Supplies', 'Paper Towels & Tissue', 'Aluminum Foil & Wraps', 'Trash Bags', 'Laundry Supplies', 'Air Fresheners'],
  'Lighters & Lighter Fuels': ['Disposable Lighters', 'Refillable Lighters', 'Butane Fuel', 'Torch Lighters', 'Lighter Accessories'],
  'OTC Medicine': ['Pain Relief', 'Cold & Flu Medicine', 'Allergy Relief', 'Digestive Health', 'Sleep Aids', 'First Aid Supplies'],
  'Personal & Health Care': ['Oral Care', 'Skin Care', 'Hair Care', 'Deodorants', 'Feminine Hygiene', 'Grooming Products'],
}

const COMMISSION_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

const EMPTY_PACKING_ROW = {
  enabled: true,
  isDefault: false,
  isFree: false,
  unitType: 'Piece',
  qty: 1,
  price: '',
  barcode: '',
  rack: '',
  section: '',
  row: '',
  boxNo: '',
  cost: '',
  whMin: '',
  retailMin: '',
  base: '',
}

function NewProductPage() {
  const [basic, setBasic] = useState({
    category: '',
    subcategory: '',
    productId: '',
    productName: '',
    brand: '',
    commissionCode: '',
    reorderMark: '',
    mlQuantity: '',
    weightOz: '',
    location: '',
    notes: '',
    srp: '',
    applyMlQuantity: false,
    applyWeightOz: false,
    expiryDate: '',
    isActive: true,
  })

  const [packingRows, setPackingRows] = useState([
    { ...EMPTY_PACKING_ROW, unitType: 'Piece' },
    { ...EMPTY_PACKING_ROW, unitType: 'Box' },
    { ...EMPTY_PACKING_ROW, unitType: 'Case' },
  ])

  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('')
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const handleBasicChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setBasic((prev) => ({ ...prev, [field]: value }))
  }

  const PRICE_FIELDS = ['cost', 'whMin', 'retailMin', 'base']

  const recomputePackings = (rows, changedIndex, changedField) => {
    const pieceIdx = rows.findIndex((r) => r.unitType === 'Piece')
    if (pieceIdx < 0) return rows

    // Always enforce piece qty = 1
    rows[pieceIdx] = { ...rows[pieceIdx], qty: 1 }

    // If user edited Box/Case price, derive per-piece price for that field (and only that field)
    if (PRICE_FIELDS.includes(changedField) && changedIndex !== pieceIdx) {
      const unit = rows[changedIndex]
      const qty = Number(unit.qty) || 0
      const total = Number(unit[changedField]) || 0
      if (qty > 0 && total > 0) {
        rows[pieceIdx] = { ...rows[pieceIdx], [changedField]: (total / qty).toFixed(3) }
      }
    }

    // If qty changed on Box/Case, keep totals in sync using per-piece values
    // If qty changed and totals were filled, also back-calc piece values.
    if (changedField === 'qty' && changedIndex !== pieceIdx) {
      const unit = rows[changedIndex]
      const qty = Number(unit.qty) || 0
      if (qty > 0) {
        PRICE_FIELDS.forEach((f) => {
          const total = Number(unit[f]) || 0
          if (total > 0) {
            rows[pieceIdx] = { ...rows[pieceIdx], [f]: (total / qty).toFixed(3) }
          }
        })
      }
    }

    const piece = rows[pieceIdx]

    // Propagate per-piece values to Box/Case totals so every unit stays consistent
    return rows.map((r, idx) => {
      if (idx === pieceIdx) return r
      const qty = Number(r.qty) || 0
      if (!qty) return r

      const updated = { ...r }
      PRICE_FIELDS.forEach((f) => {
        const perUnit = Number(piece[f]) || 0
        if (perUnit > 0) {
          updated[f] = (perUnit * qty).toFixed(3)
        }
      })
      return updated
    })
  }

  const handlePackingChange = (index, field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value

    setPackingRows((rows) => {
      const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : { ...row }))
      return recomputePackings(next, index, field)
    })
  }

  const defaultIndex = useMemo(
    () => packingRows.findIndex((r) => r.isDefault),
    [packingRows],
  )

  const handleSetDefault = (index) => {
    setPackingRows((rows) =>
      rows.map((row, i) => ({ ...row, isDefault: i === index })),
    )
  }

  // Keep a derived version for display/submit so Box/Case always reflect piece values.
  const derivedPackings = useMemo(
    () => recomputePackings(packingRows.map((r) => ({ ...r })), -1, ''),
    [packingRows],
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const syncedPackings = derivedPackings.filter((p) => p.enabled !== false)

    setSaving(true)
    const token = localStorage.getItem('token')
    const formData = new FormData()
    const payloadBasic = {
      ...basic,
      commissionPercent: basic.commissionCode ? Number(basic.commissionCode) : null,
    }

    Object.entries(payloadBasic).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      formData.append(k, String(v))
    })
    formData.append('packings', JSON.stringify(syncedPackings))
    if (imageFile) formData.append('image', imageFile)

    fetch('/api/products', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.message || 'Failed to create product')
        }
        setSuccess('Product created successfully')

        // Reset form after successful creation
        setBasic({
          category: '',
          subcategory: '',
          productId: '',
          productName: '',
          brand: '',
          commissionCode: '',
          reorderMark: '',
          mlQuantity: '',
          weightOz: '',
          location: '',
          notes: '',
          srp: '',
          applyMlQuantity: false,
          applyWeightOz: false,
          expiryDate: '',
          isActive: true,
        })
        setPackingRows([
          { ...EMPTY_PACKING_ROW, unitType: 'Piece' },
          { ...EMPTY_PACKING_ROW, unitType: 'Box' },
          { ...EMPTY_PACKING_ROW, unitType: 'Case' },
        ])
        setImageFile(null)
      })
      .catch((err) => {
        setError(err.message || 'Failed to create product')
      })
      .finally(() => setSaving(false))
  }

  return (
    <>
      <div className={dark ? 'product-create-page product-create-page--dark' : 'product-create-page'}>
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h2 className="product-create-title mb-1">Create Product</h2>
            <div className="text-muted small">
              Fill in details, then configure Piece / Box / Case pricing and barcodes.
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <Form.Check
              type="switch"
              id="dark-mode"
              label="Dark mode"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
            />
          </div>
        </div>

        <Form onSubmit={handleSubmit}>
          <Row className="g-3">
            <Col lg={8}>
              <Card className="mb-3">
                <Card.Header className="fw-semibold">Product Details</Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Category *</Form.Label>
                        <Form.Select value={basic.category} onChange={handleBasicChange('category')} required>
                          <option value="">Select category</option>
                          {Object.keys(CATEGORY_OPTIONS).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Subcategory *</Form.Label>
                        <Form.Select
                          value={basic.subcategory}
                          onChange={handleBasicChange('subcategory')}
                          required
                          disabled={!basic.category}
                        >
                          <option value="">Select subcategory</option>
                          {basic.category &&
                            CATEGORY_OPTIONS[basic.category]?.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Product ID *</Form.Label>
                        <Form.Control
                          placeholder="Product ID"
                          value={basic.productId}
                          onChange={handleBasicChange('productId')}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={8}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Product Name *</Form.Label>
                        <Form.Control
                          placeholder="Product name"
                          value={basic.productName}
                          onChange={handleBasicChange('productName')}
                          required
                        />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Brand *</Form.Label>
                        <Form.Control
                          placeholder="Brand"
                          value={basic.brand}
                          onChange={handleBasicChange('brand')}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Commission Code (%) *</Form.Label>
                        <Form.Select value={basic.commissionCode} onChange={handleBasicChange('commissionCode')} required>
                          <option value="">Select Commission Code</option>
                          {COMMISSION_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}%
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">SRP (Suggested Retail Price) *</Form.Label>
                        <div className="d-flex align-items-center gap-2">
                          <Badge bg={dark ? 'secondary' : 'light'} text={dark ? 'light' : 'dark'}>
                            $
                          </Badge>
                          <Form.Control
                            type="number"
                            className="no-spin"
                            min="0"
                            step="0.01"
                            value={basic.srp}
                            onChange={handleBasicChange('srp')}
                            required
                          />
                        </div>
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Re-order Mark (in Piece)</Form.Label>
                        <Form.Control
                          type="number"
                          className="no-spin"
                          min="0"
                          value={basic.reorderMark}
                          onChange={handleBasicChange('reorderMark')}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mt-4">
                        <Form.Check
                          type="switch"
                          id="is-active"
                          label="Item is active"
                          checked={basic.isActive}
                          onChange={handleBasicChange('isActive')}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Expiry Date</Form.Label>
                        <Form.Control type="date" value={basic.expiryDate} onChange={handleBasicChange('expiryDate')} />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Location</Form.Label>
                        <Form.Control
                          placeholder="Rack / Section / Row"
                          value={basic.location}
                          onChange={handleBasicChange('location')}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <div className="d-flex align-items-center justify-content-between">
                          <Form.Label className="fw-semibold mb-1">ML Quantity (in Piece)</Form.Label>
                          <Form.Check
                            type="checkbox"
                            id="apply-ml"
                            label="Apply ML Tax"
                            checked={basic.applyMlQuantity}
                            onChange={handleBasicChange('applyMlQuantity')}
                          />
                        </div>
                        <Form.Control
                          type="number"
                          className="no-spin"
                          min="0"
                          step="0.01"
                          value={basic.mlQuantity}
                          onChange={handleBasicChange('mlQuantity')}
                        />
                        <Form.Text muted>If checked, ML tax is charged based on Billing Address.</Form.Text>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <div className="d-flex align-items-center justify-content-between">
                          <Form.Label className="fw-semibold mb-1">Weight (oz) (in Piece)</Form.Label>
                          <Form.Check
                            type="checkbox"
                            id="apply-weight"
                            label="Apply Weight Tax"
                            checked={basic.applyWeightOz}
                            onChange={handleBasicChange('applyWeightOz')}
                          />
                        </div>
                        <Form.Control
                          type="number"
                          className="no-spin"
                          min="0"
                          step="0.01"
                          value={basic.weightOz}
                          onChange={handleBasicChange('weightOz')}
                        />
                        <Form.Text muted>If checked, Weight (oz) tax is charged based on Billing Address.</Form.Text>
                      </Form.Group>
                    </Col>

                    <Col md={12}>
                      <Form.Group>
                        <Form.Label className="fw-semibold">Notes</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={basic.notes}
                          onChange={handleBasicChange('notes')}
                          placeholder="Internal notes, special handling, etc."
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="mb-3">
                <Card.Header className="fw-semibold">Packing Details</Card.Header>
                <Card.Body className="p-0">
                  <div className="packing-table-wrapper">
                    <Table hover size="sm" className="mb-0 packing-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Enable</th>
                    <th rowSpan={2}>Set default</th>
                    <th rowSpan={2}>Free?</th>
                    <th rowSpan={2}>Unit type</th>
                    <th rowSpan={2}>Qty</th>
                    <th colSpan={4}>Price</th>
                    <th rowSpan={2}>Barcode</th>
                  </tr>
                  <tr className="packing-sub-header">
                    <th>Cost</th>
                    <th>WH. Min</th>
                    <th>Retail Min</th>
                    <th>Base</th>
                  </tr>
                </thead>
                <tbody>
                  {derivedPackings.map((row, index) => {
                  const disabled = !row.enabled
                  const commonProps = {
                    disabled,
                  }
                  return (
                    <tr key={index} style={disabled ? { opacity: 0.5 } : undefined}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={row.enabled}
                          onChange={handlePackingChange(index, 'enabled')}
                        />
                      </td>
                      <td>
                        <Form.Check
                          type="radio"
                          name="defaultPacking"
                          checked={defaultIndex === index}
                          onChange={() => handleSetDefault(index)}
                        />
                      </td>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={row.isFree}
                          onChange={handlePackingChange(index, 'isFree')}
                        />
                      </td>
                      <td>{row.unitType}</td>
                      <td>
                        <Form.Control
                          type="number"
                          className="no-spin packing-qty"
                          min="1"
                          value={row.unitType === 'Piece' ? 1 : row.qty}
                          disabled={disabled || row.unitType === 'Piece'}
                          onChange={handlePackingChange(index, 'qty')}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          className="no-spin packing-input"
                          min="0"
                          step="0.001"
                          value={row.cost}
                          onChange={handlePackingChange(index, 'cost')}
                          {...commonProps}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          className="no-spin packing-input"
                          min="0"
                          step="0.001"
                          value={row.whMin}
                          onChange={handlePackingChange(index, 'whMin')}
                          {...commonProps}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          className="no-spin packing-input"
                          min="0"
                          step="0.001"
                          value={row.retailMin}
                          onChange={handlePackingChange(index, 'retailMin')}
                          {...commonProps}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          className="no-spin packing-input"
                          min="0"
                          step="0.001"
                          value={row.base}
                          onChange={handlePackingChange(index, 'base')}
                          {...commonProps}
                        />
                      </td>
                      <td>
                        <Form.Control
                          className="packing-input"
                          value={row.barcode}
                          onChange={handlePackingChange(index, 'barcode')}
                          placeholder="Scan"
                          {...commonProps}
                        />
                      </td>
                    </tr>
                  )
                })}
                </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>

              {error && <p className="text-danger small mt-2 mb-0">{error}</p>}
              {success && <p className="text-success small mt-2 mb-0">{success}</p>}

              <div className="d-flex justify-content-end gap-2 mt-3">
                <Button
                  type="button"
                  variant={dark ? 'outline-light' : 'outline-secondary'}
                  onClick={() => {
                    setBasic({
                      category: '',
                      subcategory: '',
                      productId: '',
                      productName: '',
                      brand: '',
                      commissionCode: '',
                      reorderMark: '',
                      mlQuantity: '',
                      weightOz: '',
                      location: '',
                      notes: '',
                      srp: '',
                      applyMlQuantity: false,
                      applyWeightOz: false,
                      expiryDate: '',
                    })
                    setPackingRows([
                      { ...EMPTY_PACKING_ROW, unitType: 'Piece' },
                      { ...EMPTY_PACKING_ROW, unitType: 'Box' },
                      { ...EMPTY_PACKING_ROW, unitType: 'Case' },
                    ])
                    setImageFile(null)
                  }}
                >
                  Reset
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Create Product'}
                </Button>
              </div>
            </Col>

            <Col lg={4}>
              <div style={{ position: 'sticky', top: 90 }}>
                <Card className="mb-3">
                  <Card.Header className="fw-semibold">Product Image</Card.Header>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Control
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                      <Form.Text muted>Recommended ratio 1:1 (PNG/JPG).</Form.Text>
                    </Form.Group>

                    <div
                      className="product-image-preview"
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                        background: dark ? 'rgba(255,255,255,0.04)' : '#f7f9ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {imagePreviewUrl ? (
                        <img
                          src={imagePreviewUrl}
                          alt="Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div className="text-muted small text-center px-3">
                          No image selected.
                          <div className="mt-1">Upload to preview here.</div>
                        </div>
                      )}
                    </div>
                  </Card.Body>
                </Card>

                <Card>
                  <Card.Header className="fw-semibold">Preview</Card.Header>
                  <Card.Body>
                    <div className="small text-muted mb-2">What you’re about to create</div>
                    <div className="fw-semibold">{basic.productName || 'Product name'}</div>
                    <div className="text-muted small">
                      {basic.category || 'Category'} / {basic.subcategory || 'Subcategory'}
                    </div>
                    <div className="mt-2 d-flex flex-wrap gap-2">
                      {basic.brand && <Badge bg={dark ? 'secondary' : 'light'} text={dark ? 'light' : 'dark'}>{basic.brand}</Badge>}
                      {basic.productId && <Badge bg="info">{basic.productId}</Badge>}
                      {basic.srp && <Badge bg="success">${Number(basic.srp || 0).toFixed(2)}</Badge>}
                    </div>
                  </Card.Body>
                </Card>
              </div>
            </Col>
          </Row>
        </Form>
      </div>
    </>
  )
}

export default NewProductPage

