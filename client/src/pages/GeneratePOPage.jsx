import { useEffect, useMemo, useState } from 'react'
import { Card, Form, Button, Table, Row, Col, Modal } from 'react-bootstrap'
import { api } from '../api/api'

const UNIT_TYPES = ['Piece', 'Box', 'Case']

function formatDateForInput(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function GeneratePOPage() {
  const today = useMemo(() => formatDateForInput(new Date()), [])

  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [header, setHeader] = useState({
    vendor: '',
    vendorInvoiceNo: '',
    date: today,
    remark: '',
  })
  const [barcodeInput, setBarcodeInput] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const selectedProduct = useMemo(
    () => products.find((p) => p._id === selectedProductId) || null,
    [products, selectedProductId],
  )
  const [selectedUnitType, setSelectedUnitType] = useState('Piece')
  const [selectedQty, setSelectedQty] = useState(1)
  const [lineItems, setLineItems] = useState([])
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successModal, setSuccessModal] = useState({ show: false, message: '', poNumber: '' })

  useEffect(() => {
    let cancelled = false
    api.get('/api/vendors?limit=all').then((r) => r.json()).then((data) => {
      if (!cancelled && Array.isArray(data.items)) setVendors(data.items)
    }).catch(() => { if (!cancelled) setVendors([]) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get('/api/products?limit=all&status=Active').then((r) => r.json()).then((data) => {
      if (!cancelled && Array.isArray(data.items)) setProducts(data.items)
    }).catch(() => { if (!cancelled) setProducts([]) })
    return () => { cancelled = true }
  }, [])

  const handleHeaderChange = (field) => (e) => {
    const value = e.target.value
    if (field === 'remark' && value.length > 200) return
    setHeader((prev) => ({ ...prev, [field]: value }))
  }

  const findProductAndPackingByBarcode = (barcode) => {
    const q = String(barcode || '').trim().toLowerCase()
    if (!q) return null
    for (const p of products) {
      const packing = (p.packings || []).find((pk) => pk.barcode && String(pk.barcode).toLowerCase() === q)
      if (packing) return { product: p, packing }
    }
    return null
  }

  const filteredProducts = useMemo(() => {
    const query = String(productSearch || '').trim().toLowerCase()
    if (!query) return products
    return products.filter((p) => {
      const idMatch = p.productId?.toLowerCase().includes(query)
      const nameMatch = p.productNameLower?.includes(query) || (p.productName && p.productName.toLowerCase().includes(query))
      const barcodeMatch = (p.packings || []).some((pk) => pk.barcode && String(pk.barcode).toLowerCase().includes(query))
      return idMatch || nameMatch || barcodeMatch
    })
  }, [products, productSearch])

  const addLineFromProduct = (product, unitType, receiverPOQty) => {
    if (!product) return false
    const alreadyInList = lineItems.some((item) => String(item.productId) === String(product.productId))
    if (alreadyInList) {
      setError('This product is already in the list. You cannot add the same product with a different unit.')
      return false
    }
    const pack = (product.packings || []).find((p) => p.unitType === unitType)
    const qtyPerUnit = pack ? Number(pack.qty) || 1 : 1
    const totalPieces = receiverPOQty * qtyPerUnit
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.productId,
        productName: product.productName,
        expiryDate: product.expiryDate || null,
        unitType,
        receiverPOQty: Number(receiverPOQty) || 1,
        totalPieces,
      },
    ])
    setSelectedProductId('')
    setProductSearch('')
    setSelectedQty(1)
    setSelectedUnitType('Piece')
    setError('')
    return true
  }

  const canAddProducts = Boolean(header.vendor && header.vendorInvoiceNo.trim())

  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!canAddProducts) {
      setError('Select vendor and enter Vendor Invoice No. before adding products.')
      return
    }
    const found = findProductAndPackingByBarcode(barcodeInput)
    if (found) {
      const { product, packing } = found
      const unitType = packing.unitType || 'Piece'
      addLineFromProduct(product, unitType, 1)
      setBarcodeInput('')
    }
  }

  const handleAddLine = () => {
    if (!canAddProducts) {
      setError('Select vendor and enter Vendor Invoice No. before adding products.')
      return
    }
    if (!selectedProduct) {
      setError('Select a product first.')
      return
    }
    addLineFromProduct(selectedProduct, selectedUnitType, selectedQty)
  }

  const handleProductSelect = (e) => {
    const id = e.target.value
    setSelectedProductId(id || '')
    if (id) {
      const p = products.find((x) => x._id === id)
      if (p) {
        const def = (p.packings || []).find((x) => x.isDefault) || (p.packings || [])[0]
        setSelectedUnitType(def?.unitType || 'Piece')
        setSelectedQty(1)
      }
    }
  }

  const removeLine = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totalReceiverQty = lineItems.reduce((s, i) => s + (Number(i.receiverPOQty) || 0), 0)
  const totalPiecesSum = lineItems.reduce((s, i) => s + (Number(i.totalPieces) || 0), 0)

  const buildFormData = (statusToUse) => {
    const form = new FormData()
    form.append('vendor', header.vendor)
    form.append('vendorInvoiceNo', header.vendorInvoiceNo.trim())
    form.append('status', statusToUse)
    form.append('date', header.date)
    form.append('remark', header.remark)
    form.append('lineItems', JSON.stringify(lineItems))
    if (invoiceFile) form.append('invoice', invoiceFile)
    return form
  }

  const submit = async (statusToUse) => {
    if (!header.vendor) {
      setError('Vendor is required.')
      return
    }
    if (!header.vendorInvoiceNo.trim()) {
      setError('Vendor Invoice No is required.')
      return
    }
    if (!header.date) {
      setError('Date is required.')
      return
    }
    if (lineItems.length === 0) {
      setError('Add at least one product line.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/po', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: buildFormData(statusToUse),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to save PO')
      const poNum = data.poNumber || ''
      const message = statusToUse === 'generated' ? 'PO generated successfully.' : 'PO saved as draft successfully.'
      setHeader((prev) => ({ ...prev, vendor: '', vendorInvoiceNo: '', date: today, remark: '' }))
      setLineItems([])
      setBarcodeInput('')
      setProductSearch('')
      setSelectedProductId('')
      setSelectedQty(1)
      setSelectedUnitType('Piece')
      setInvoiceFile(null)
      setSuccessModal({ show: true, message, poNumber: poNum })
    } catch (err) {
      setError(err.message || 'Failed to save PO')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setHeader((prev) => ({ ...prev, vendor: '', vendorInvoiceNo: '', date: today, remark: '' }))
    setLineItems([])
    setBarcodeInput('')
    setProductSearch('')
    setSelectedProductId('')
    setSelectedQty(1)
    setSelectedUnitType('Piece')
    setInvoiceFile(null)
    setError('')
    setSuccessModal((prev) => ({ ...prev, show: false }))
  }

  const selectedProductPackings = useMemo(() => {
    if (!selectedProduct || !selectedProduct.packings) return []
    return selectedProduct.packings.filter((p) => p.enabled !== false)
  }, [selectedProduct])

  const selectedTotalPieces = useMemo(() => {
    if (!selectedProduct) return 0
    const pack = (selectedProduct.packings || []).find((p) => p.unitType === selectedUnitType)
    const qtyPerUnit = pack ? Number(pack.qty) || 1 : 1
    return (Number(selectedQty) || 0) * qtyPerUnit
  }, [selectedProduct, selectedUnitType, selectedQty])

  return (
    <div className="product-list-page">
      <h2 className="mb-4">Generate PO</h2>

      <Card className="mb-3">
        <Card.Header className="fw-semibold">PO details</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Vendor *</Form.Label>
                <Form.Select
                  value={header.vendor}
                  onChange={handleHeaderChange('vendor')}
                  required
                  aria-label="Select vendor"
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>{v.vendorName} ({v.vendorId})</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Vendor Invoice No. *</Form.Label>
                <Form.Control
                  value={header.vendorInvoiceNo}
                  onChange={handleHeaderChange('vendorInvoiceNo')}
                  placeholder="Vendor Invoice No (unique)"
                />
                <Form.Text className="text-muted">Must be unique across all POs.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Control type="text" value="Draft" readOnly disabled className="bg-secondary bg-opacity-10 text-muted" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Date *</Form.Label>
                <Form.Control type="date" value={header.date} onChange={handleHeaderChange('date')} />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Remark (max 200 characters)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={header.remark}
                  onChange={handleHeaderChange('remark')}
                  maxLength={200}
                  placeholder="Remark"
                />
                <Form.Text className="text-muted">Note: Remark up to 200 characters.</Form.Text>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header className="fw-semibold">Add products</Card.Header>
        <Card.Body>
          {!canAddProducts && (
            <p className="text-muted small mb-3">Select vendor and enter Vendor Invoice No. above to add products.</p>
          )}
          <Row className="g-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Barcode</Form.Label>
                <Form.Control
                  placeholder="Enter Barcode here (if barcode is added then the product adds directly to the list)"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  disabled={!canAddProducts}
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Row className="g-2">
                <Col md={3}>
                  <Form.Label className="mb-0">Product *</Form.Label>
                </Col>
                <Col md={4}>
                  <Form.Control
                    placeholder="Search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    disabled={!canAddProducts}
                  />
                </Col>
                <Col md={5}>
                  <Form.Select value={selectedProductId} onChange={handleProductSelect} aria-label="Select product" disabled={!canAddProducts}>
                    <option value="">Select Product</option>
                    {filteredProducts.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.productId} - {p.productName}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Unit Type *</Form.Label>
                <Form.Select
                  value={selectedUnitType}
                  onChange={(e) => setSelectedUnitType(e.target.value)}
                  disabled={!canAddProducts || !selectedProduct}
                >
                  <option value="">- Select -</option>
                  {(selectedProductPackings.length ? selectedProductPackings.map((p) => p.unitType) : UNIT_TYPES)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((ut) => (
                      <option key={ut} value={ut}>{ut}</option>
                    ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Quantity *</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(parseInt(e.target.value, 10) || 1)}
                  disabled={!canAddProducts || !selectedProduct}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Total Pieces</Form.Label>
                <Form.Control type="text" readOnly value={selectedTotalPieces} disabled />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleAddLine}
                disabled={!canAddProducts || !selectedProduct}
              >
                ADD
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body className="p-0">
          <Table className="product-list-table mb-0">
            <thead>
              <tr>
                <th>Action</th>
                <th>ID</th>
                <th>Product Name</th>
                <th>Expiry Date</th>
                <th>Unit Type</th>
                <th>Receiver PO Qty</th>
                <th>Total Pieces</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => removeLine(idx)} aria-label="Remove">
                      ×
                    </button>
                  </td>
                  <td>{item.productId}</td>
                  <td>{item.productName}</td>
                  <td>{item.expiryDate ? formatDateForInput(item.expiryDate) : '-'}</td>
                  <td>{item.unitType}</td>
                  <td>{item.receiverPOQty}</td>
                  <td>{item.totalPieces}</td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted">No items. Add products above.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-end fw-semibold">Total</td>
                <td>{totalReceiverQty}</td>
                <td>{totalPiecesSum}</td>
              </tr>
            </tfoot>
          </Table>
        </Card.Body>
        <Card.Footer className="d-flex flex-wrap gap-2 align-items-center">
          <Button variant="outline-secondary" size="sm" onClick={handleReset} disabled={saving}>Reset</Button>
          <Button variant="outline-primary" size="sm" onClick={() => submit('draft')} disabled={saving}>
            Save as draft
          </Button>
          <Button variant="primary" size="sm" onClick={() => submit('generated')} disabled={saving}>
            Generate PO
          </Button>
        </Card.Footer>
      </Card>

      <Card className="mb-3">
        <Card.Header className="fw-semibold">Upload Invoice IR</Card.Header>
        <Card.Body>
          <Form.Group>
            <Form.Control
              type="file"
              accept=".png,.jpg,.jpeg,.docx,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f && f.size <= 2 * 1024 * 1024) setInvoiceFile(f)
                else if (f) setError('Max file size is 2MB.')
                else setInvoiceFile(null)
              }}
            />
            <Form.Text className="text-muted">Allowed: png, jpg, jpeg, docx, pdf. Max size: 2MB.</Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      <Modal show={Boolean(error)} onHide={() => setError('')} centered>
        <Modal.Header className="border-0 pt-3 pb-0">
          <Modal.Title className="text-danger small mb-0">Error</Modal.Title>
          <button
            type="button"
            className="btn btn-link p-0 text-danger text-decoration-none ms-auto"
            style={{ fontSize: '1.5rem', lineHeight: 1 }}
            aria-label="Close"
            onClick={() => setError('')}
          >
            ×
          </button>
        </Modal.Header>
        <Modal.Body className="text-center pt-2 pb-4">
          <p className="text-danger mb-0">{error}</p>
        </Modal.Body>
      </Modal>

      <Modal show={successModal.show} onHide={() => setSuccessModal((prev) => ({ ...prev, show: false }))} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-success">Success</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="mb-2">{successModal.message}</p>
          {successModal.poNumber && (
            <p className="mb-0 fs-4 fw-bold text-primary">PO Number: {successModal.poNumber}</p>
          )}
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="primary" onClick={() => setSuccessModal((prev) => ({ ...prev, show: false }))}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default GeneratePOPage
