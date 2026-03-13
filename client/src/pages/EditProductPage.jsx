import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { api } from '../api/api'

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

const PRICE_FIELDS = ['cost', 'whMin', 'retailMin', 'base']

function EditProductPage() {
  const { id } = useParams()
  const [basic, setBasic] = useState(null)
  const [packingRows, setPackingRows] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api
      .get(`/api/products/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || 'Failed to load product')
        if (!alive) return
        setBasic({
          category: data.category || '',
          subcategory: data.subcategory || '',
          productId: data.productId || '',
          productName: data.productName || '',
          brand: data.brand || '',
          commissionCode: data.commissionPercent ? String(data.commissionPercent) : '',
          reorderMark: data.reorderMark ?? '',
          mlQuantity: data.mlQuantity ?? '',
          weightOz: data.weightOz ?? '',
          location: data.location || '',
          notes: data.notes || '',
          srp: data.srp ?? '',
          applyMlQuantity: !!data.applyMlQuantity,
          applyWeightOz: !!data.applyWeightOz,
          expiryDate: data.expiryDate ? data.expiryDate.slice(0, 10) : '',
          isActive: data.isActive !== false,
          imageFileName: data.imageFileName || '',
        })
        setPackingRows(
          (Array.isArray(data.packings) ? data.packings : []).map((p) => ({
            enabled: p.enabled !== false,
            isDefault: !!p.isDefault,
            isFree: !!p.isFree,
            unitType: p.unitType || 'Piece',
            qty: p.qty || 1,
            price: p.price ?? '',
            barcode: p.barcode || '',
            rack: p.rack || '',
            section: p.section || '',
            row: p.row || '',
            boxNo: p.boxNo || '',
            cost: p.cost ?? '',
            whMin: p.whMin ?? '',
            retailMin: p.retailMin ?? '',
            base: p.base ?? '',
          })),
        )
      })
      .catch((e) => setError(e.message || 'Failed to load product'))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

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

  const recomputePackings = (rows, changedIndex, changedField) => {
    const pieceIdx = rows.findIndex((r) => r.unitType === 'Piece')
    if (pieceIdx < 0) return rows

    rows[pieceIdx] = { ...rows[pieceIdx], qty: 1 }

    if (PRICE_FIELDS.includes(changedField) && changedIndex !== pieceIdx) {
      const unit = rows[changedIndex]
      const qty = Number(unit.qty) || 0
      const total = Number(unit[changedField]) || 0
      if (qty > 0 && total > 0) {
        rows[pieceIdx] = { ...rows[pieceIdx], [changedField]: (total / qty).toFixed(3) }
      }
    }

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

  const derivedPackings = useMemo(
    () => recomputePackings(packingRows.map((r) => ({ ...r })), -1, ''),
    [packingRows],
  )

  const subcategoryOptions = useMemo(() => {
    if (!basic?.category) return []
    return CATEGORY_OPTIONS[basic.category] || []
  }, [basic?.category])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!basic) return
    setError('')
    setSuccess('')
    setSaving(true)

    const token = localStorage.getItem('token')
    const formData = new FormData()

    const payloadBasic = {
      ...basic,
      commissionPercent: basic.commissionCode ? Number(basic.commissionCode) : null,
    }

    // Never allow productId or productName to be changed
    delete payloadBasic.productId
    delete payloadBasic.productName

    Object.entries(payloadBasic).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      formData.append(k, String(v))
    })
    formData.append('packings', JSON.stringify(derivedPackings))
    if (imageFile) formData.append('image', imageFile)

    fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || 'Failed to update product')
        setSuccess('Product updated successfully')
      })
      .catch((err) => setError(err.message || 'Failed to update product'))
      .finally(() => setSaving(false))
  }

  if (loading || !basic) {
    return <div>Loading…</div>
  }

  return (
    <div className="product-create-page">
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="product-create-title mb-1">Edit Product</h2>
          <div className="text-muted small">
            You can update pricing, barcodes and other details. Product ID and Product Name cannot be changed.
          </div>
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
                      <Form.Select
                        value={basic.category}
                        onChange={handleBasicChange('category')}
                        required
                      >
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
                        {subcategoryOptions.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Product ID</Form.Label>
                      <Form.Control value={basic.productId} disabled />
                      <Form.Text muted>Product ID cannot be changed.</Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Product Name</Form.Label>
                      <Form.Control value={basic.productName} disabled />
                      <Form.Text muted>Product name cannot be changed.</Form.Text>
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
                      <Form.Select
                        value={basic.commissionCode}
                        onChange={handleBasicChange('commissionCode')}
                        required
                      >
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
                        <Badge bg="light" text="dark">
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
                    <Form.Group>
                      <Form.Label className="fw-semibold">Expiry Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={basic.expiryDate}
                        onChange={handleBasicChange('expiryDate')}
                      />
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
                          id="apply-ml-edit"
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
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <div className="d-flex align-items-center justify-content-between">
                        <Form.Label className="fw-semibold mb-1">Weight (oz) (in Piece)</Form.Label>
                        <Form.Check
                          type="checkbox"
                          id="apply-weight-edit"
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

                  <Col md={12}>
                    <Form.Group className="mt-2">
                      <Form.Check
                        type="switch"
                        id="is-active-edit"
                        label="Item is active"
                        checked={basic.isActive}
                        onChange={handleBasicChange('isActive')}
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
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Update Product'}
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
                      border: '1px solid rgba(0,0,0,0.08)',
                      background: '#f7f9ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {imagePreviewUrl || basic.imageFileName ? (
                      <img
                        src={imagePreviewUrl || `/uploads/products/${basic.imageFileName}`}
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
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  )
}

export default EditProductPage

