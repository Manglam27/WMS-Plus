import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

function EditPOPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [po, setPo] = useState(null)
  const [products, setProducts] = useState([])
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('')
  const [remark, setRemark] = useState('')
  const [lineItems, setLineItems] = useState([])
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const selectedProduct = useMemo(
    () => products.find((p) => p._id === selectedProductId) || null,
    [products, selectedProductId],
  )
  const [selectedUnitType, setSelectedUnitType] = useState('Piece')
  const [selectedQty, setSelectedQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get(`/api/po/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data._id) {
          setPo(data)
          setVendorInvoiceNo(data.vendorInvoiceNo || '')
          setRemark(data.remark || '')
          setLineItems(Array.isArray(data.lineItems) ? data.lineItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            expiryDate: item.expiryDate,
            unitType: item.unitType || 'Piece',
            receiverPOQty: Number(item.receiverPOQty) || 1,
            totalPieces: Number(item.totalPieces) || 0,
          })) : [])
        } else setError(data.message || 'PO not found')
      })
      .catch(() => { if (!cancelled) setError('Failed to load PO') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    let cancelled = false
    api.get('/api/products?limit=all&status=Active')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.items)) setProducts(data.items)
      })
      .catch(() => { if (!cancelled) setProducts([]) })
    return () => { cancelled = true }
  }, [])

  const statusLabel = po?.status === 'generated' ? 'Pending Approval' : 'Draft'

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

  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const found = findProductAndPackingByBarcode(barcodeInput)
    if (found) {
      const { product, packing } = found
      const unitType = packing.unitType || 'Piece'
      addLineFromProduct(product, unitType, 1)
      setBarcodeInput('')
    }
  }

  const handleAddLine = () => {
    if (!selectedProduct) {
      setError('Select a product first.')
      return
    }
    addLineFromProduct(selectedProduct, selectedUnitType, selectedQty)
  }

  const handleProductSelect = (e) => {
    const pid = e.target.value
    setSelectedProductId(pid || '')
    if (pid) {
      const p = products.find((x) => x._id === pid)
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

  const handleSave = async () => {
    if (!vendorInvoiceNo.trim()) {
      setError('Vendor Invoice No is required.')
      return
    }
    if (remark.length > 200) {
      setError('Remark must be at most 200 characters.')
      return
    }
    if (lineItems.length === 0) {
      setError('Add at least one product line.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const form = new FormData()
      form.append('vendorInvoiceNo', vendorInvoiceNo.trim())
      form.append('remark', remark)
      form.append('lineItems', JSON.stringify(lineItems))
      if (invoiceFile) form.append('invoice', invoiceFile)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/po/${id}`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to update PO')
      setPo(data)
      setInvoiceFile(null)
      setSuccessMessage('PO updated successfully.')
    } catch (err) {
      setError(err.message || 'Failed to update PO')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleteConfirm(false)
    setDeleting(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/po/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete PO')
      }
      navigate('/po/list')
    } catch (err) {
      setError(err.message || 'Failed to delete PO')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="product-list-page">
        <p className="text-muted">Loading PO...</p>
      </div>
    )
  }
  if (!po || error === 'PO not found') {
    return (
      <div className="product-list-page">
        <p className="text-danger">PO not found.</p>
        <Button variant="outline-secondary" size="sm" onClick={() => navigate('/po/list')}>Back to PO List</Button>
      </div>
    )
  }

  return (
    <div className="product-list-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Edit PO</h2>
        <Button variant="outline-secondary" size="sm" onClick={() => navigate('/po/list')}>Back to PO List</Button>
      </div>

      <Card className="mb-3">
        <Card.Header className="fw-semibold">PO details</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Vendor</Form.Label>
                <Form.Control
                  type="text"
                  value={po.vendor ? (po.vendor.vendorName || po.vendor.vendorId) : '-'}
                  readOnly
                  disabled
                  className="bg-secondary bg-opacity-10"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Vendor Invoice No. *</Form.Label>
                <Form.Control
                  value={vendorInvoiceNo}
                  onChange={(e) => setVendorInvoiceNo(e.target.value)}
                  placeholder="Vendor Invoice No (unique)"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <div className="pt-2">
                  <span
                    className={
                      po?.status === 'generated'
                        ? 'po-status-badge po-status-badge--pending'
                        : 'po-status-badge po-status-badge--draft'
                    }
                  >
                    {statusLabel}
                  </span>
                </div>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="text"
                  value={formatDateForInput(po.date)}
                  readOnly
                  disabled
                  className="bg-secondary bg-opacity-10"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>PO Number</Form.Label>
                <Form.Control type="text" value={po.poNumber || '-'} readOnly disabled className="bg-secondary bg-opacity-10" />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Remark (max 200 characters)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={remark}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v.length <= 200) setRemark(v)
                  }}
                  maxLength={200}
                  placeholder="Remark"
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header className="fw-semibold">Products</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Barcode</Form.Label>
                <Form.Control
                  placeholder="Scan or enter barcode to add product"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
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
                  />
                </Col>
                <Col md={5}>
                  <Form.Select value={selectedProductId} onChange={handleProductSelect} aria-label="Select product">
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
                  disabled={!selectedProduct}
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
                  disabled={!selectedProduct}
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
              <Button type="button" variant="primary" size="sm" onClick={handleAddLine} disabled={!selectedProduct}>
                ADD
              </Button>
            </Col>
          </Row>
        </Card.Body>
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
                    <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => removeLine(idx)} aria-label="Remove">×</button>
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
            <Form.Text className="text-muted">Allowed: png, jpg, jpeg, docx, pdf. Max size: 2MB. Optional; replaces existing if selected.</Form.Text>
          </Form.Group>
        </Card.Body>
        <Card.Footer className="d-flex flex-wrap gap-2 align-items-center">
          <Button variant="outline-danger" size="sm" onClick={() => setDeleteConfirm(true)} disabled={saving || deleting}>
            Delete PO
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || deleting}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Card.Footer>
      </Card>

      {error && (
        <Modal show onHide={() => setError('')} centered>
          <Modal.Header className="border-0 pt-3 pb-0">
            <Modal.Title className="text-danger small mb-0">Error</Modal.Title>
            <button type="button" className="btn btn-link p-0 text-danger ms-auto" aria-label="Close" onClick={() => setError('')}>×</button>
          </Modal.Header>
          <Modal.Body className="text-center pt-2 pb-4"><p className="text-danger mb-0">{error}</p></Modal.Body>
        </Modal>
      )}

      {successMessage && (
        <Modal show onHide={() => setSuccessMessage('')} centered>
          <Modal.Header closeButton><Modal.Title className="text-success">Success</Modal.Title></Modal.Header>
          <Modal.Body className="text-center py-4"><p className="mb-0">{successMessage}</p></Modal.Body>
          <Modal.Footer className="justify-content-center">
            <Button variant="primary" onClick={() => setSuccessMessage('')}>OK</Button>
          </Modal.Footer>
        </Modal>
      )}

      <Modal show={deleteConfirm} onHide={() => setDeleteConfirm(false)} centered>
        <Modal.Header closeButton><Modal.Title>Delete PO</Modal.Title></Modal.Header>
        <Modal.Body>Are you sure you want to delete this PO? This cannot be undone.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default EditPOPage
