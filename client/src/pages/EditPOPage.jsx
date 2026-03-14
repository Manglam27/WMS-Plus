import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Form, Button, Table, Row, Col, Modal } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'
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
  const { user } = useAuth()
  const role = user?.role
  const [po, setPo] = useState(null)
  const [products, setProducts] = useState([])
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [remark, setRemark] = useState('')
  const [lineItems, setLineItems] = useState([])
  const [vendorCreditPercent, setVendorCreditPercent] = useState(0)
  const [vendorCreditAmount, setVendorCreditAmount] = useState(0)
  const [tax, setTax] = useState(0)
  const [shippingHandling, setShippingHandling] = useState(0)
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
  const [selectedUnitPrice, setSelectedUnitPrice] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [receiveConfirm, setReceiveConfirm] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const isStockEntry = (role === 'inventory_manager' || role === 'admin') && po && ['generated', 'revert', 'verified', 'received'].includes(po.status)
  const isReceived = po?.status === 'received'
  const DRAFT_STATUS_MAP = { generated: 'New', revert: 'Revert', verified: 'Verified', received: 'Received' }
  const stockEntryStatusLabel = po ? (DRAFT_STATUS_MAP[po.status] || po.status) : ''
  const stockEntryStatusBadgeClass = po?.status === 'received' ? 'po-status-badge po-status-badge--received' : po?.status === 'verified' ? 'po-status-badge po-status-badge--verified' : po?.status === 'revert' ? 'po-status-badge po-status-badge--revert' : 'po-status-badge po-status-badge--new'

  useEffect(() => {
    let cancelled = false
    api.get(`/api/po/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data._id) {
          setPo(data)
          setVendorInvoiceNo(data.vendorInvoiceNo || '')
          setInvoiceDate(formatDateForInput(data.date))
          setRemark(data.remark || '')
          setVendorCreditPercent(Number(data.vendorCreditPercent) || 0)
          setVendorCreditAmount(Number(data.vendorCreditAmount) || 0)
          setTax(Number(data.tax) || 0)
          setShippingHandling(Number(data.shippingHandling) || 0)
          setLineItems(Array.isArray(data.lineItems) ? data.lineItems.map((item) => {
            const rvq = Number(item.receiverVerifiedQty) || 0
            const up = Number(item.unitPrice) || 0
            return {
              productId: item.productId,
              productName: item.productName,
              expiryDate: item.expiryDate,
              unitType: item.unitType || 'Piece',
              receiverPOQty: Number(item.receiverPOQty) || 1,
              totalPieces: Number(item.totalPieces) || 0,
              receiverVerifiedQty: rvq,
              unitPrice: up,
              totalPrice: rvq * up,
            }
          }) : [])
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

  const addLineFromProduct = (product, unitType, receiverPOQty, unitPriceOverride) => {
    if (!product) return false
    const alreadyInList = lineItems.some((item) => String(item.productId) === String(product.productId))
    if (alreadyInList) {
      setError('This product is already in the list. You cannot add the same product with a different unit.')
      return false
    }
    const pack = (product.packings || []).find((p) => p.unitType === unitType)
    const qtyPerUnit = pack ? Number(pack.qty) || 1 : 1
    const totalPieces = receiverPOQty * qtyPerUnit
    const unitPrice = unitPriceOverride != null ? Number(unitPriceOverride) : (pack?.cost ?? pack?.price ?? 0)
    const receiverVerifiedQty = 0
    const totalPrice = receiverVerifiedQty * unitPrice
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.productId,
        productName: product.productName,
        expiryDate: product.expiryDate || null,
        unitType,
        receiverPOQty: Number(receiverPOQty) || 1,
        totalPieces,
        receiverVerifiedQty,
        unitPrice,
        totalPrice,
      },
    ])
    setSelectedProductId('')
    setProductSearch('')
    setSelectedQty(1)
    setSelectedUnitType('Piece')
    setSelectedUnitPrice(0)
    setError('')
    return true
  }

  const updateLineItem = (index, field, value) => {
    setLineItems((prev) => {
      const next = prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item }
        if (field === 'unitPrice') {
          const up = Number(value) || 0
          updated.unitPrice = up
          updated.totalPrice = (Number(item.receiverVerifiedQty) || 0) * up
        } else if (field === 'expiryDate') {
          updated.expiryDate = value || null
        } else if (field === 'receiverVerifiedQty') {
          const vq = Math.max(0, parseInt(value, 10) || 0)
          updated.receiverVerifiedQty = vq
          updated.totalPrice = vq * (Number(item.unitPrice) || 0)
        }
        return updated
      })
      return next
    })
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
    addLineFromProduct(selectedProduct, selectedUnitType, selectedQty, isStockEntry ? selectedUnitPrice : undefined)
  }

  const handleProductSelect = (e) => {
    const pid = e.target.value
    setSelectedProductId(pid || '')
    if (pid) {
      const p = products.find((x) => x._id === pid)
      if (p) {
        const def = (p.packings || []).find((x) => x.isDefault) || (p.packings || [])[0]
        const ut = def?.unitType || 'Piece'
        setSelectedUnitType(ut)
        setSelectedQty(1)
        if (isStockEntry) {
          const pack = (p.packings || []).find((x) => x.unitType === ut)
          setSelectedUnitPrice(Number(pack?.cost ?? pack?.price) || 0)
        }
      }
    } else {
      setSelectedUnitPrice(0)
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

  const selectedTotalPrice = useMemo(() => {
    if (!isStockEntry) return 0
    return (Number(selectedQty) || 0) * (Number(selectedUnitPrice) || 0)
  }, [isStockEntry, selectedQty, selectedUnitPrice])

  const subtotal = useMemo(() => lineItems.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0), [lineItems])
  const totalAmount = Math.max(0, subtotal - vendorCreditAmount + tax + shippingHandling)

  const handleVendorCreditPercentChange = (pct) => {
    const val = parseFloat(pct) || 0
    setVendorCreditPercent(val)
    setVendorCreditAmount(subtotal > 0 ? Math.round((subtotal * val / 100) * 100) / 100 : 0)
  }
  const handleVendorCreditAmountChange = (amount) => {
    const val = parseFloat(amount) || 0
    setVendorCreditAmount(val)
    setVendorCreditPercent(subtotal > 0 ? Math.round((val / subtotal) * 10000) / 100 : 0)
  }

  const savePoForm = (saveStatus) => {
    const form = new FormData()
    form.append('vendorInvoiceNo', vendorInvoiceNo.trim())
    form.append('remark', remark)
    if (isStockEntry) {
      form.append('date', invoiceDate)
      form.append('vendorCreditPercent', String(vendorCreditPercent))
      form.append('vendorCreditAmount', String(vendorCreditAmount))
      form.append('tax', String(tax))
      form.append('shippingHandling', String(shippingHandling))
      if (saveStatus === 'revert' || saveStatus === 'verified') {
        form.append('status', saveStatus)
      }
    }
    const itemsToSend = lineItems.map((item) => {
      const rvq = Number(item.receiverVerifiedQty) || 0
      const up = Number(item.unitPrice) || 0
      return { ...item, expiryDate: item.expiryDate || undefined, receiverVerifiedQty: rvq, unitPrice: up, totalPrice: rvq * up }
    })
    form.append('lineItems', JSON.stringify(itemsToSend))
    if (invoiceFile) form.append('invoice', invoiceFile)
    return form
  }

  const handleSave = async (saveStatus) => {
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
    if (isStockEntry && !invoiceDate) {
      setError('Invoice Date is required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const form = savePoForm(saveStatus)
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
      const msg = saveStatus === 'revert' ? 'PO reverted.' : saveStatus === 'verified' ? 'Changes saved (Verified).' : isReceived ? 'Price updated.' : 'PO updated successfully.'
      setSuccessMessage(msg)
    } catch (err) {
      setError(err.message || 'Failed to update PO')
    } finally {
      setSaving(false)
    }
  }

  const handleReceiveStock = async () => {
    setReceiveConfirm(false)
    if (!vendorInvoiceNo.trim() || lineItems.length === 0 || (isStockEntry && !invoiceDate)) {
      setError('Please complete Vendor Invoice No., Invoice Date, and at least one product line.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const form = savePoForm('verified')
      const putRes = await fetch(`/api/po/${id}`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const putData = await putRes.json().catch(() => ({}))
      if (!putRes.ok) throw new Error(putData.message || 'Failed to save PO before receiving.')
      const receiveRes = await fetch(`/api/po/${id}/receive`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (receiveRes.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return
      }
      const receiveData = await receiveRes.json().catch(() => ({}))
      if (!receiveRes.ok) throw new Error(receiveData.message || 'Failed to receive stock.')
      setSuccessMessage('Stock received successfully. PO has been moved to Received Invoices.')
      setPo(receiveData)
      setTimeout(() => {
        navigate('/po/received')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to receive stock')
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
      navigate(isStockEntry ? '/po/draft' : '/po/list')
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
    <div className="product-list-page edit-po-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        {isStockEntry ? (
          <nav aria-label="Breadcrumb" className="stock-entry-breadcrumb">
            <span className="text-muted">Stock Entry</span>
            <span className="mx-1 text-muted">/</span>
            <span className="text-muted">Home</span>
            <span className="mx-1 text-muted">/</span>
            <span className="text-muted">Purchase Order</span>
            <span className="mx-1 text-muted">/</span>
            <span className="text-muted">By Vendor</span>
            <span className="mx-1 text-muted">/</span>
            <span>Stock Entry</span>
          </nav>
        ) : (
          <h2 className="mb-0">Edit PO</h2>
        )}
        <Button variant="outline-secondary" size="sm" onClick={() => navigate(isReceived ? '/po/received' : isStockEntry ? '/po/draft' : '/po/list')}>
          Back to {isReceived ? 'PO List (Received)' : isStockEntry ? 'Draft PO List' : 'PO List'}
        </Button>
      </div>

      {isStockEntry ? (
        <>
          <Card className="mb-3">
            <Card.Header className="fw-semibold">Purchase Order</Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Vendor *</Form.Label>
                    <Form.Control type="text" value={po.vendor ? (po.vendor.vendorName || po.vendor.vendorId) : '-'} readOnly disabled className="bg-secondary bg-opacity-10" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Vendor Invoice No *</Form.Label>
                    <Form.Control value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} placeholder="Vendor Invoice No" />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Invoice Date *</Form.Label>
                    <Form.Control type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <div className="pt-2">
                      <span className={stockEntryStatusBadgeClass}>{stockEntryStatusLabel}</span>
                    </div>
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
                    <Form.Label>Remark</Form.Label>
                    <Form.Control as="textarea" rows={2} value={remark} onChange={(e) => { const v = e.target.value; if (v.length <= 200) setRemark(v); }} maxLength={200} placeholder="Remark" />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="mb-3">
            {!isReceived && <Card.Header className="fw-semibold">Add product</Card.Header>}
            {!isReceived && (
              <Card.Body>
                <Row className="g-3">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Barcode</Form.Label>
                      <Form.Control placeholder="Enter Barcode here" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeKeyDown} />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Row className="g-2">
                      <Col md={3}><Form.Label className="mb-0">Product *</Form.Label></Col>
                      <Col md={4}>
                        <Form.Control placeholder="Search Product" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                      </Col>
                      <Col md={5}>
                        <Form.Select value={selectedProductId} onChange={handleProductSelect} aria-label="Select product">
                          <option value="">- Select Product -</option>
                          {filteredProducts.map((p) => (
                            <option key={p._id} value={p._id}>{p.productId} - {p.productName}</option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Unit Type *</Form.Label>
                      <Form.Select value={selectedUnitType} onChange={(e) => { const ut = e.target.value; setSelectedUnitType(ut); if (selectedProduct) { const pack = (selectedProduct.packings || []).find((p) => p.unitType === ut); setSelectedUnitPrice(Number(pack?.cost ?? pack?.price) || 0); } }} disabled={!selectedProduct}>
                        <option value="">- Select -</option>
                        {(selectedProductPackings.length ? selectedProductPackings.map((p) => p.unitType) : UNIT_TYPES).filter((v, i, a) => a.indexOf(v) === i).map((ut) => (<option key={ut} value={ut}>{ut}</option>))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Quantity *</Form.Label>
                      <Form.Control type="number" min={1} value={selectedQty} onChange={(e) => setSelectedQty(parseInt(e.target.value, 10) || 1)} disabled={!selectedProduct} />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Total Pieces</Form.Label>
                      <Form.Control type="text" readOnly value={selectedTotalPieces} disabled />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Unit Price *</Form.Label>
                      <Form.Control type="number" min={0} step={0.01} value={selectedUnitPrice} onChange={(e) => setSelectedUnitPrice(parseFloat(e.target.value) || 0)} disabled={!selectedProduct} />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Total Price</Form.Label>
                      <Form.Control type="text" readOnly value={selectedTotalPrice.toFixed(2)} disabled />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Button type="button" variant="primary" size="sm" onClick={handleAddLine} disabled={!selectedProduct}>ADD</Button>
                  </Col>
                </Row>
              </Card.Body>
            )}
            <Card.Body className="p-0">
              <Table className="product-list-table mb-0 stock-entry-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>ID</th>
                    <th>Product Name</th>
                    <th>Unit Type</th>
                    <th>Receiver PO Qty</th>
                    <th>Expiry Date</th>
                    <th>Receiver Verified Qty</th>
                    <th>PO Pieces</th>
                    <th>Unit Price</th>
                    <th>Total Price</th>
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
                      <td>{item.unitType}</td>
                      <td>{item.receiverPOQty}</td>
                      <td>
                        {isReceived ? (item.expiryDate ? formatDateForInput(item.expiryDate) : '-') : (
                          <Form.Control type="date" size="sm" value={item.expiryDate ? formatDateForInput(item.expiryDate) : ''} onChange={(e) => updateLineItem(idx, 'expiryDate', e.target.value || null)} />
                        )}
                      </td>
                      <td>
                        {isReceived ? (item.receiverVerifiedQty ?? 0) : (
                          <Form.Control type="number" min={0} size="sm" value={item.receiverVerifiedQty ?? 0} onChange={(e) => updateLineItem(idx, 'receiverVerifiedQty', e.target.value)} style={{ maxWidth: 70 }} />
                        )}
                      </td>
                      <td>{item.totalPieces}</td>
                      <td className="text-end">
                        <Form.Control type="number" min={0} step={0.01} size="sm" value={item.unitPrice ?? 0} onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)} style={{ maxWidth: 90 }} className="text-end" />
                      </td>
                      <td className="text-end">{(Math.round((Number(item.receiverVerifiedQty) || 0) * (Number(item.unitPrice) || 0) * 1000) / 1000).toFixed(3)}</td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr><td colSpan={10} className="text-center text-muted">No items. Add products above.</td></tr>
                  )}
                </tbody>
              </Table>
              <div className="stock-entry-totals p-3 border-top bg-light">
                <div className="stock-entry-totals-row">
                  <span><strong>Total Item</strong></span>
                  <span className="text-end">{lineItems.length}</span>
                </div>
                <div className="stock-entry-totals-row">
                  <span><strong>Subtotal</strong></span>
                  <span className="text-end">$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="stock-entry-totals-row">
                  <span><strong>Vendor Credit</strong></span>
                  <span className="d-flex align-items-center justify-content-end gap-1">
                    <Form.Control type="number" min={0} step={0.01} size="sm" value={vendorCreditPercent} onChange={(e) => handleVendorCreditPercentChange(e.target.value)} placeholder="%" className="stock-entry-input-inline" style={{ width: 64 }} title="Percentage (auto-calculated from amount)" />
                    <span>%</span>
                    <Form.Control type="number" min={0} step={0.01} size="sm" value={vendorCreditAmount} onChange={(e) => handleVendorCreditAmountChange(e.target.value)} placeholder="0" className="stock-entry-input-inline" style={{ width: 80 }} title="Amount (auto-calculates %)" />
                    <span>$</span>
                  </span>
                </div>
                <div className="stock-entry-totals-row">
                  <span><strong>Tax</strong></span>
                  <span className="text-end d-flex align-items-center justify-content-end gap-1">
                    <span>$</span>
                    <Form.Control type="number" min={0} step={0.01} size="sm" value={tax} onChange={(e) => setTax(parseFloat(e.target.value) || 0)} className="stock-entry-input-inline" style={{ width: 80 }} />
                  </span>
                </div>
                <div className="stock-entry-totals-row">
                  <span><strong>Shipping &amp; Handling Charge</strong></span>
                  <span className="text-end d-flex align-items-center justify-content-end gap-1">
                    <span>$</span>
                    <Form.Control type="number" min={0} step={0.01} size="sm" value={shippingHandling} onChange={(e) => setShippingHandling(parseFloat(e.target.value) || 0)} className="stock-entry-input-inline" style={{ width: 80 }} />
                  </span>
                </div>
                <div className="stock-entry-totals-row pt-2 border-top mt-2">
                  <span><strong>Total</strong></span>
                  <span className="text-end fw-bold">$ {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </>
      ) : (
        <>
          <Card className="mb-3">
            <Card.Header className="fw-semibold">PO details</Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Vendor</Form.Label>
                    <Form.Control type="text" value={po.vendor ? (po.vendor.vendorName || po.vendor.vendorId) : '-'} readOnly disabled className="bg-secondary bg-opacity-10" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Vendor Invoice No. *</Form.Label>
                    <Form.Control value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} placeholder="Vendor Invoice No (unique)" />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <div className="pt-2">
                      <span className={po?.status === 'generated' ? 'po-status-badge po-status-badge--pending' : 'po-status-badge po-status-badge--draft'}>{statusLabel}</span>
                    </div>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Date</Form.Label>
                    <Form.Control type="text" value={formatDateForInput(po.date)} readOnly disabled className="bg-secondary bg-opacity-10" />
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
                    <Form.Control as="textarea" rows={2} value={remark} onChange={(e) => { const v = e.target.value; if (v.length <= 200) setRemark(v); }} maxLength={200} placeholder="Remark" />
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
                    <Form.Control placeholder="Scan or enter barcode to add product" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeKeyDown} />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Row className="g-2">
                    <Col md={3}><Form.Label className="mb-0">Product *</Form.Label></Col>
                    <Col md={4}><Form.Control placeholder="Search" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} /></Col>
                    <Col md={5}>
                      <Form.Select value={selectedProductId} onChange={handleProductSelect} aria-label="Select product">
                        <option value="">Select Product</option>
                        {filteredProducts.map((p) => (<option key={p._id} value={p._id}>{p.productId} - {p.productName}</option>))}
                      </Form.Select>
                    </Col>
                  </Row>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Unit Type *</Form.Label>
                    <Form.Select value={selectedUnitType} onChange={(e) => setSelectedUnitType(e.target.value)} disabled={!selectedProduct}>
                      <option value="">- Select -</option>
                      {(selectedProductPackings.length ? selectedProductPackings.map((p) => p.unitType) : UNIT_TYPES).filter((v, i, a) => a.indexOf(v) === i).map((ut) => (<option key={ut} value={ut}>{ut}</option>))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Quantity *</Form.Label>
                    <Form.Control type="number" min={1} value={selectedQty} onChange={(e) => setSelectedQty(parseInt(e.target.value, 10) || 1)} disabled={!selectedProduct} />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Total Pieces</Form.Label>
                    <Form.Control type="text" readOnly value={selectedTotalPieces} disabled />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Button type="button" variant="primary" size="sm" onClick={handleAddLine} disabled={!selectedProduct}>ADD</Button>
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
                      <td><button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => removeLine(idx)} aria-label="Remove">×</button></td>
                      <td>{item.productId}</td>
                      <td>{item.productName}</td>
                      <td>{item.expiryDate ? formatDateForInput(item.expiryDate) : '-'}</td>
                      <td>{item.unitType}</td>
                      <td>{item.receiverPOQty}</td>
                      <td>{item.totalPieces}</td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No items. Add products above.</td></tr>}
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
        </>
      )}

      <Card className="mb-3">
        <Card.Header className="fw-semibold">Upload Invoice {isStockEntry ? 'Manager' : 'IR'}</Card.Header>
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
            <Form.Text className="text-muted">Allowed file: [png, jpg, jpeg, docx, pdf]. Max size is: 2MB.</Form.Text>
          </Form.Group>
        </Card.Body>
        <Card.Footer className="d-flex flex-wrap gap-2 align-items-center">
          {isStockEntry ? (
            <>
              <Button variant="outline-warning" size="sm" onClick={() => handleSave('revert')} disabled={saving || deleting}>{saving ? 'Saving...' : 'Revert PO'}</Button>
              {!isReceived && (
                <>
                  <Button variant="outline-primary" size="sm" onClick={() => handleSave('verified')} disabled={saving || deleting}>{saving ? 'Saving...' : 'Verified'}</Button>
                  <Button variant="primary" size="sm" onClick={() => setReceiveConfirm(true)} disabled={saving || deleting}>Generate PO</Button>
                </>
              )}
              {isReceived && (
                <Button variant="primary" size="sm" onClick={() => handleSave()} disabled={saving || deleting}>{saving ? 'Saving...' : 'Update Price'}</Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline-danger" size="sm" onClick={() => setDeleteConfirm(true)} disabled={saving || deleting}>Delete PO</Button>
              <Button variant="primary" size="sm" onClick={() => handleSave()} disabled={saving || deleting}>{saving ? 'Saving...' : 'Save'}</Button>
            </>
          )}
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

      <Modal show={receiveConfirm} onHide={() => setReceiveConfirm(false)} centered>
        <Modal.Header closeButton><Modal.Title>Generate PO – Receive Stock</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="mb-0">Are you sure you want to generate the PO? This will directly receive the stock in the system and save in the database. Product costs and stock will be updated, and this PO will move to Received Invoices.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setReceiveConfirm(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleReceiveStock} disabled={saving}>{saving ? 'Receiving...' : 'Receive it'}</Button>
        </Modal.Footer>
      </Modal>

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
