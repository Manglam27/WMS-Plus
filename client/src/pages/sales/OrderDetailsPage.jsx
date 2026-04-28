import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'

function money(v) {
  return (Number(v) || 0).toFixed(2)
}

function OrderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showLogModal, setShowLogModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [assignChoice, setAssignChoice] = useState('customer')
  const [actionMessage, setActionMessage] = useState('')
  const [showInvoicePrintModal, setShowInvoicePrintModal] = useState(false)
  const [invoiceTemplate, setInvoiceTemplate] = useState('default')
  const [companySettings, setCompanySettings] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelRemark, setCancelRemark] = useState('')

  useEffect(() => {
    api
      .get(`/api/sales/orders/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data) throw new Error(data?.message || 'Failed to load order.')
        setOrder(data)
      })
      .catch((e) => setError(e.message || 'Failed to load order.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    api
      .get('/api/sales/drivers')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok) setDrivers(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    api
      .get('/api/company-settings')
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (res.ok && data) setCompanySettings(data)
      })
      .catch(() => {})
  }, [])

  const historyRows = useMemo(() => {
    if (!order) return []
    const rawLogs = Array.isArray(order.logs) ? order.logs : []
    if (rawLogs.length > 0) {
      return rawLogs
        .map((log, i) => ({
          id: `${log.at || i}-${log.action || i}`,
          action: log.action || 'Action',
          by: log.byUserName || 'User',
          at: log.at ? new Date(log.at).getTime() : 0,
          atLabel: log.at ? new Date(log.at).toLocaleString() : '—',
        }))
        .sort((a, b) => b.at - a.at)
    }
    const events = [
      { title: 'Order created', when: order.createdAt },
      { title: 'Packed', when: order.packedAt },
      { title: 'Shipped', when: order.shippedAt },
      { title: 'Delivered / Undelivered', when: order.deliveredAt },
      { title: 'Cancelled', when: order.cancelledAt },
      { title: 'Closed', when: order.closedAt },
    ]
    return events
      .filter((e) => e.when)
      .map((e, i) => ({ id: `${e.title}-${i}`, action: e.title, by: 'System', atLabel: new Date(e.when).toLocaleString() }))
  }, [order])

  const getShippingRowClass = (shippingType) => {
    const raw = String(shippingType || '').toLowerCase()
    if (raw.includes('ups')) return 'order-row--shipping-ups'
    if (raw.includes('sales pickup')) return 'order-row--shipping-sales-pickup'
    if (raw.includes('customer pickup')) return 'order-row--shipping-customer-pickup'
    return ''
  }

  const getPackedRowClass = (line) => {
    const ordered = Number(line?.qty || 0)
    const packed = Number(line?.packedQty ?? 0)
    if (ordered <= 0) return ''
    if (packed <= 0) return 'order-detail-row--packed-zero'
    if (packed < ordered) return 'order-detail-row--packed-partial'
    return ''
  }

  const canAssignDriver = ['packed', 'add-on-packed'].includes(order?.status)
  const canCancel = ['sales_manager', 'admin'].includes(user?.role) &&
    ['new', 'processed', 'add-on', 'packed', 'add-on-packed', 'ready-to-ship'].includes(order?.status)
  const canPrintPackedLabel = ['packed', 'add-on-packed', 'ready-to-ship', 'shipped', 'delivered', 'undelivered', 'close'].includes(order?.status)
  const isSalesPerson = user?.role === 'sales_person'
  const isSalesPersonViewOnly = isSalesPerson && ['shipped', 'delivered', 'undelivered', 'close', 'cancelled'].includes(String(order?.status || ''))

  const assignDriver = async () => {
    if (!order) return
    setActionMessage('')
    if (!assignChoice) {
      setActionMessage('Select assignment option.')
      return
    }
    const isCustomer = assignChoice === 'customer'
    const isSalesPerson = assignChoice === 'sales_person'
    const isUpsDriver = assignChoice === 'ups_driver'
    const payload = isCustomer
      ? { action: 'assign_driver', assignTarget: 'customer' }
      : isSalesPerson
        ? { action: 'assign_driver', assignTarget: 'sales_person' }
        : isUpsDriver
          ? { action: 'assign_driver', assignTarget: 'ups_driver' }
          : { action: 'assign_driver', assignTarget: 'driver', driverId: assignChoice }
    const res = await api.patch(`/api/sales/orders/${order._id}/workflow`, payload)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setActionMessage(data.message || 'Failed to assign order.')
      return
    }
    setOrder(data)
    setShowAssignModal(false)
  }

  const cancelOrder = async () => {
    if (!order) return
    const remark = String(cancelRemark || '').trim()
    if (!remark) {
      setError('Reason for canceling the order is required.')
      return
    }
    const res = await api.patch(`/api/sales/orders/${order._id}/workflow`, { action: 'cancel_new', remark })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.message || 'Failed to cancel order.')
      return
    }
    setOrder(data)
    setCancelRemark('')
    setShowCancelModal(false)
  }

  const printPackedBoxLabels = () => {
    if (!order) return
    const totalBoxes = Math.max(1, Number(order?.noOfPackedBoxes) || 1)
    const orderNo = String(order.orderNumber || '').trim()
    const orderNoLast4 = orderNo ? orderNo.slice(-4) : ''
    const customerId = String(
      order.customer?.customerNumber || order.customer?.customerId || order.customer?._id || '',
    ).trim() || '-'
    const shippingAddress = String(order.shippingAddress || '').trim() || '-'
    const salesPersonName = String(order.salesPerson?.name || order.salesPerson?.username || '').trim() || '-'

    const labelHtml = Array.from({ length: totalBoxes }, (_, i) => {
      const boxNo = i + 1
      return `
        <div class="sticker">
          <div class="sticker-card">
            <div class="sticker-header">${customerId}</div>
            <div class="order-no">${orderNoLast4 || orderNo || '-'}</div>
            <div class="box-meta">Box ${boxNo} of ${totalBoxes}</div>
            <div class="barcode-wrap"><svg id="barcode-${boxNo}"></svg></div>
            <div class="address-block">${shippingAddress}</div>
            <div class="sales-footer">Sales Person: ${salesPersonName}</div>
          </div>
        </div>
      `
    }).join('')

    const win = window.open('', '_blank', 'width=1024,height=900')
    if (!win) return
    win.document.open()
    win.document.write(`
      <html>
        <head>
          <title>Packed Box Barcode Labels</title>
          <style>
            @page { size: 4in 6in; margin: 0; }
            html, body {
              width: 4in;
              height: 6in;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .sticker {
              width: 4in;
              height: 6in;
              box-sizing: border-box;
              padding: 0.2in;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              background: #fff;
              page-break-after: always;
            }
            .sticker:last-child {
              page-break-after: auto;
            }
            .sticker-card {
              width: 100%;
              height: 100%;
              box-sizing: border-box;
              border: 2px solid #111;
              border-radius: 10px;
              padding: 0.22in;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              align-items: center;
            }
            .sticker-header {
              width: 100%;
              text-align: center;
              border: 1px solid #222;
              border-radius: 6px;
              padding: 8px 10px;
              font-size: 18px;
              font-weight: 800;
              letter-spacing: 1px;
              margin-bottom: 14px;
            }
            .order-no {
              font-size: 54px;
              font-weight: 800;
              line-height: 1.2;
              text-align: center;
              margin-bottom: 10px;
              word-break: break-word;
              letter-spacing: 1px;
            }
            .box-meta {
              font-size: 28px;
              font-weight: 800;
              text-align: center;
              margin-bottom: 14px;
              letter-spacing: 0.3px;
            }
            .barcode-wrap {
              width: 100%;
              border: 1.5px solid #111;
              border-radius: 8px;
              padding: 12px 8px 10px;
              display: flex;
              justify-content: center;
              align-items: center;
              margin-top: 4px;
              margin-bottom: 12px;
            }
            .sales-footer {
              width: 100%;
              text-align: center;
              border-top: 1px dashed #666;
              padding-top: 8px;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 0.2px;
            }
            .address-block {
              width: 100%;
              border: 1px solid #ccc;
              border-radius: 6px;
              padding: 8px 10px;
              margin-bottom: 8px;
              font-size: 12px;
              line-height: 1.3;
              font-weight: 600;
              text-align: left;
              white-space: normal;
              word-break: break-word;
            }
          </style>
        </head>
        <body>
          ${labelHtml}
          <script>
            window.__barcodeReady = false;
            function renderAndPrint() {
              if (window.__barcodeReady) return;
              if (typeof JsBarcode !== 'function') return;
              window.__barcodeReady = true;
              ${Array.from({ length: totalBoxes }, (_, idx) => {
                const boxNo = idx + 1
                const barcodeValue = `${orderNo}/${boxNo}`
                return `
                  try {
                    JsBarcode('#barcode-${boxNo}', ${JSON.stringify(barcodeValue)}, {
                      format:'CODE128',
                      width:2.6,
                      height:120,
                      margin:0,
                      displayValue:true,
                      fontSize:28,
                      fontOptions:'bold',
                      textMargin:8
                    });
                  } catch (e) {}
                `
              }).join('\n')}
              requestAnimationFrame(() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 120);
              });
            }
            window.addEventListener('load', () => setTimeout(renderAndPrint, 50));
          </script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" onload="renderAndPrint()"></script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const printInvoice = () => {
    if (!order) return
    const win = window.open('', '_blank', 'width=1000,height=860')
    if (!win) return
    const orderNo = String(order.orderNumber || '')
    const invoiceTitle = invoiceTemplate === 'sales_quote' ? 'Sales Quote Invoice' : 'Invoice'
    const companyName = String(companySettings?.companyName || 'Your Company').trim()
    const companyLogo = companySettings?.logoFileName
      ? `/api/uploads/company/${companySettings.logoFileName}`
      : ''
    const companyAddress = [
      companySettings?.addressLine1,
      companySettings?.addressLine2,
      [companySettings?.city, companySettings?.state, companySettings?.zipCode].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n')
    const taxLabel = String(companySettings?.salesTaxLabel || 'Sales Tax').trim() || 'Sales Tax'
    const taxPercent = Math.max(0, Number(companySettings?.salesTaxPercent) || 0)
    const taxDisplay = companySettings?.enableSalesTax === false
      ? `${taxLabel}: Disabled`
      : `${taxLabel} (${taxPercent.toFixed(2)}%)`
    const footerDisclosure = String(companySettings?.invoiceDisclosure || '').trim()
    const footerTerms = String(companySettings?.invoiceTerms || order.terms || '').trim()
    const groupedByCategory = (order.lineItems || []).reduce((acc, item) => {
      const category = String(
        item?.baseCategory || item?.category || item?.categoryName || item?.productCategory || 'Uncategorized',
      ).trim() || 'Uncategorized'
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    }, {})
    const categorySections = Object.entries(groupedByCategory)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([category, items]) => {
        const rows = [...items]
          .sort((a, b) => {
            const nameA = String(a?.productName || '').trim()
            const nameB = String(b?.productName || '').trim()
            const byName = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
            if (byName !== 0) return byName
            const idA = String(a?.productId || '').trim()
            const idB = String(b?.productId || '').trim()
            return idA.localeCompare(idB, undefined, { sensitivity: 'base' })
          })
          .map((l) => `
            <tr>
              <td>${l.productId || ''}</td>
              <td>${l.productName || ''}</td>
              <td>${l.unitType || ''}</td>
              <td style="text-align:right;">${Number(l.qty || 0)}</td>
              <td style="text-align:right;">${money(l.srp)}</td>
              <td style="text-align:right;">${money(l.unitPrice)}</td>
              <td style="text-align:right;">${money(l.netPrice)}</td>
            </tr>
          `)
          .join('')
        const categoryTotal = items.reduce((sum, l) => sum + (Number(l.netPrice) || 0), 0)
        return `
          <div class="category-block">
            <div class="category-title">${category}</div>
            <table>
              <colgroup>
                <col style="width: 12%;" />
                <col style="width: 32%;" />
                <col style="width: 10%;" />
                <col style="width: 8%;" />
                <col style="width: 12%;" />
                <col style="width: 13%;" />
                <col style="width: 13%;" />
              </colgroup>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Product</th>
                  <th>Unit</th>
                  <th style="text-align:right;">Qty</th>
                  <th style="text-align:right;">SRP</th>
                  <th style="text-align:right;">Unit Price</th>
                  <th style="text-align:right;">Net Price</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="category-total"><strong>${category} Subtotal:</strong> $ ${money(categoryTotal)}</div>
          </div>
        `
      })
      .join('')
    win.document.write(`
      <html>
        <head>
          <title>${invoiceTitle} - ${orderNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 18px; color: #0f172a; background: #fff; }
            .sheet { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
            .head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:8px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
            .head h3 { margin:0; color: #1e293b; }
            .invoice-code { font-size: 13px; color: #334155; margin-top: 6px; }
            .meta { border:1px solid #cbd5e1; background:#f8fafc; border-radius:8px; padding:10px 12px; margin-bottom:14px; line-height:1.45; font-size:14px; display:grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
            .category-block { margin-bottom: 14px; }
            .category-title { background: #e2e8f0; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700; font-size: 13px; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; }
            table { width:100%; border-collapse:collapse; font-size:13px; table-layout: fixed; }
            th { background:#1e293b; color:#fff; border:1px solid #334155; text-align:left; padding:8px; }
            td { border:1px solid #cbd5e1; padding:7px 8px; vertical-align:top; overflow-wrap:anywhere; }
            .category-total { text-align:right; margin-top: 6px; font-size: 13px; }
            .totals { margin-top:12px; text-align:right; font-size:14px; }
            .totals div { margin-bottom:4px; }
            .footer-notes { margin-top: 16px; border-top: 1px dashed #94a3b8; padding-top: 12px; display:grid; grid-template-columns: 1fr; gap: 10px; font-size: 12px; }
            .note-card { border:1px solid #cbd5e1; border-radius:8px; padding:10px; background:#fafafa; break-inside: avoid; page-break-inside: avoid; }
            .note-title { font-weight:700; margin-bottom:5px; color:#0f172a; }
            .note-body { white-space: pre-wrap; line-height: 1.5; color:#334155; overflow-wrap: anywhere; word-break: break-word; hyphens: auto; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="head">
              <div>
                ${companyLogo ? `<img src="${companyLogo}" alt="" style="max-height:56px;max-width:180px;object-fit:contain;margin-bottom:8px;" />` : ''}
                <div style="font-size:20px;font-weight:700;line-height:1.2;margin-bottom:2px;">${companyName}</div>
                ${companyAddress ? `<div style="white-space:pre-wrap;font-size:12px;color:#334155;margin-bottom:6px;">${companyAddress}</div>` : ''}
                <h3>${invoiceTitle}</h3>
                <div class="invoice-code">Invoice No: ${orderNo}</div>
              </div>
              <div style="text-align:right; font-size:12px; color:#334155;">
                <div><strong>Date:</strong> ${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '—'}</div>
                <div><strong>Delivery:</strong> ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '—'}</div>
              </div>
            </div>
            <div class="meta">
              <div><strong>Customer:</strong> ${order.customer?.customerName || order.customer?.businessName || ''}</div>
              <div><strong>Sales Person:</strong> ${order.salesPerson?.name || order.salesPerson?.username || ''}</div>
              <div><strong>Shipping Type:</strong> ${order.shippingType || '-'}</div>
              <div><strong>Tax:</strong> ${taxDisplay}</div>
              <div style="grid-column:1 / span 2;"><strong>Shipping Address:</strong> ${order.shippingAddress || '-'}</div>
            </div>
            ${categorySections}
            <div class="totals">
              <div><strong>Subtotal:</strong> $ ${money(order.subtotal)}</div>
              <div><strong>Shipping:</strong> $ ${money(order.shippingCharges)}</div>
              <div><strong>${taxLabel}:</strong> $ ${money(order.totalTax)}</div>
              <div><strong>Grand Total:</strong> $ ${money(order.orderTotal)}</div>
            </div>
            <div class="footer-notes">
              <div class="note-card">
                <div class="note-title">Disclosure</div>
                <div class="note-body">${footerDisclosure || '-'}</div>
              </div>
              <div class="note-card">
                <div class="note-title">Terms</div>
                <div class="note-body">${footerTerms || '-'}</div>
              </div>
            </div>
          </div>
          <script>
            window.addEventListener('load', () => {
              requestAnimationFrame(() => setTimeout(() => { window.focus(); window.print(); }, 100));
            });
          </script>
        </body>
      </html>
    `)
    win.document.close()
    setShowInvoicePrintModal(false)
  }

  if (loading) return <p>Loading order details...</p>
  if (!order) return <Alert variant="danger">{error || 'Order not found.'}</Alert>

  return (
    <div className="sales-tablet-page sales-order-details-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Order Detail</h3>
        </div>
      </div>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Card className="mb-3">
        <Card.Header>Order Information</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={3}><Form.Label>Order No</Form.Label><Form.Control value={order.orderNumber || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Order Date</Form.Label><Form.Control value={order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''} readOnly /></Col>
            <Col md={3}><Form.Label>Order Status</Form.Label><div className="mt-1"><Badge bg="primary">{order.status || 'new'}</Badge></div></Col>
            <Col md={3}><Form.Label>Delivery Date</Form.Label><Form.Control value={order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : ''} readOnly /></Col>
            <Col md={3}><Form.Label>Sales Person</Form.Label><Form.Control value={order.salesPerson?.name || order.salesPerson?.username || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Customer</Form.Label><Form.Control value={order.customer?.customerName || order.customer?.businessName || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Packed Boxes</Form.Label><Form.Control value={Math.max(1, Number(order.noOfPackedBoxes) || 1)} readOnly /></Col>
            <Col md={3}><Form.Label>Terms</Form.Label><Form.Control value={order.terms || ''} readOnly /></Col>
            <Col md={3}><Form.Label>Shipping Type</Form.Label><Form.Control value={order.shippingType || ''} readOnly /></Col>
            <Col md={6}><Form.Label>Billing Address</Form.Label><Form.Control as="textarea" rows={2} value={order.billingAddress || ''} readOnly /></Col>
            <Col md={6}><Form.Label>Shipping Address</Form.Label><Form.Control as="textarea" rows={2} value={order.shippingAddress || ''} readOnly /></Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header>Item Details</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>Unit</th>
                <th className="text-end">Ordered Qty</th>
                <th>Barcode</th>
                <th className="text-end">Packed Qty</th>
                <th className="text-end">Total Pieces</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">SRP</th>
                <th className="text-end">Item Total</th>
                <th className="text-end">Discount (%)</th>
                <th className="text-end">Discount Amount</th>
                <th className="text-end">Net Price</th>
                <th>Item Scan Time</th>
              </tr>
            </thead>
            <tbody>
              {(order.lineItems || []).map((l, idx) => (
                <tr
                  key={`${l.productId}-${idx}`}
                  className={`${getShippingRowClass(order.shippingType)} ${getPackedRowClass(l)}`.trim()}
                >
                  <td>{l.productId}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span>{l.productName}</span>
                      {l.isAddedLater && <Badge bg="primary">Added later</Badge>}
                    </div>
                  </td>
                  <td>{l.unitType}</td>
                  <td className="text-end">{Number(l.qty || 0)}</td>
                  <td>{l.barcode || '—'}</td>
                  <td className="text-end">{Number(l.packedQty ?? l.qty ?? 0)}</td>
                  <td className="text-end">{Number(l.pieces || 0)}</td>
                  <td className="text-end">{money(l.unitPrice)}</td>
                  <td className="text-end">{money(l.srp)}</td>
                  <td className="text-end">{money(l.lineTotal)}</td>
                  <td className="text-end">{money(l.discountPercent)}</td>
                  <td className="text-end">{money(l.discountAmount)}</td>
                  <td className="text-end">{money(l.netPrice)}</td>
                  <td>{l.itemScanTime ? new Date(l.itemScanTime).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Body>
          <Row>
            <Col md={6}>
              <div className="small"><strong>Total Amount:</strong> $ {money(order.subtotal)}</div>
              <div className="small"><strong>Shipping Charges:</strong> $ {money(order.shippingCharges)}</div>
              <div className="small"><strong>Total Tax:</strong> $ {money(order.totalTax)}</div>
            </Col>
            <Col md={6} className="text-md-end">
              <div><strong>Grand Total:</strong> $ {money(order.orderTotal)}</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Footer className="d-flex flex-wrap justify-content-end gap-2">
          {isSalesPersonViewOnly ? (
            <>
              <Button variant="dark" onClick={() => setShowLogModal(true)}>View Log</Button>
              <Button variant="secondary" onClick={() => navigate('/sales/orders')}>Back</Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => navigate(`/sales/orders/new?edit=${order._id}`)}>Edit</Button>
              {!isSalesPerson && (
                <>
                  <Button variant="warning" onClick={() => setShowAssignModal(true)} disabled={!canAssignDriver}>Assign Driver</Button>
                  <Button variant="outline-primary" onClick={() => setShowInvoicePrintModal(true)}>
                    Print Invoice
                  </Button>
                  <Button variant="info" onClick={printPackedBoxLabels} disabled={!canPrintPackedLabel}>
                    Packed Box Barcode
                  </Button>
                  <Button variant="danger" onClick={() => setShowCancelModal(true)} disabled={!canCancel}>Cancel Order</Button>
                </>
              )}
              <Button variant="dark" onClick={() => setShowLogModal(true)}>View Log</Button>
              <Button variant="secondary" onClick={() => navigate('/sales/orders')}>Back</Button>
            </>
          )}
        </Card.Footer>
      </Card>

      <Modal show={showLogModal} onHide={() => setShowLogModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Order Log</Modal.Title></Modal.Header>
        <Modal.Body>
          {historyRows.length === 0 ? (
            <div className="text-muted">No log entries yet.</div>
          ) : (
            <Table bordered size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((h) => (
                  <tr key={h.id}>
                    <td>{h.action}</td>
                    <td>{h.by}</td>
                    <td>{h.atLabel}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowLogModal(false)}>Close</Button></Modal.Footer>
      </Modal>

      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Assign Order</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Check
            type="radio"
            name="driver-choice"
            label={<span className="fw-bold text-primary">Sales Person: {order?.salesPerson?.name || order?.salesPerson?.username || 'Sales Person'}</span>}
            checked={assignChoice === 'sales_person'}
            onChange={() => setAssignChoice('sales_person')}
          />
          <Form.Check
            type="radio"
            name="driver-choice"
            label="Customer Pickup"
            checked={assignChoice === 'customer'}
            onChange={() => setAssignChoice('customer')}
          />
          <hr className="my-2" />
          {drivers.map((d) => (
            <Form.Check
              key={d._id}
              type="radio"
              name="driver-choice"
              label={d.name || d.username}
              checked={assignChoice === d._id}
              onChange={() => setAssignChoice(d._id)}
            />
          ))}
          <Form.Check
            type="radio"
            name="driver-choice"
            label="UPS Driver"
            checked={assignChoice === 'ups_driver'}
            onChange={() => setAssignChoice('ups_driver')}
          />
          {actionMessage && <div className="text-danger small mt-2">{actionMessage}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Close</Button>
          <Button variant="primary" onClick={assignDriver}>Assign</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showInvoicePrintModal} onHide={() => setShowInvoicePrintModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Print Invoice</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="small mb-2">Choose invoice template</div>
          <Form.Check
            type="radio"
            id="invoice-template-default"
            name="invoice-template"
            label="Default Template"
            checked={invoiceTemplate === 'default'}
            onChange={() => setInvoiceTemplate('default')}
          />
          <Form.Check
            type="radio"
            id="invoice-template-sales-quote"
            name="invoice-template"
            label="Sales Quote Invoice"
            checked={invoiceTemplate === 'sales_quote'}
            onChange={() => setInvoiceTemplate('sales_quote')}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowInvoicePrintModal(false)}>Close</Button>
          <Button variant="primary" onClick={printInvoice}>Print</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Cancel Order Warning</Modal.Title></Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="mb-2">
            You are about to cancel this order. Reason for canceling the order.
          </Alert>
          <Form.Group>
            <Form.Label>Reason for canceling the order <span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              value={cancelRemark}
              onChange={(e) => setCancelRemark(e.target.value)}
              placeholder="Reason for canceling the order..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>Close</Button>
          <Button variant="danger" onClick={cancelOrder}>Cancel Order</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default OrderDetailsPage
