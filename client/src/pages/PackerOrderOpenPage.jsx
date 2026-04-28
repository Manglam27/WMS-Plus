import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/api'

function PackerOrderOpenPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showLogModal, setShowLogModal] = useState(false)
  const [scanQty, setScanQty] = useState(1)
  const [scanIsExchange, setScanIsExchange] = useState(false)
  const [scanIsFreeItem, setScanIsFreeItem] = useState(false)
  const [scanBarcode, setScanBarcode] = useState('')
  const [scanProductKey, setScanProductKey] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [noOfPackedBoxes, setNoOfPackedBoxes] = useState(1)
  const [savedPackedBoxes, setSavedPackedBoxes] = useState(1)
  const [lastPrintedBoxCount, setLastPrintedBoxCount] = useState(1)
  const [showBoxUpdateModal, setShowBoxUpdateModal] = useState(false)
  const [boxUpdateCount, setBoxUpdateCount] = useState(1)
  const [packerCounts, setPackerCounts] = useState({
    all: 0,
    processed: 0,
    'add-on': 0,
    packed: 0,
    'add-on-packed': 0,
  })
  const [scanAlert, setScanAlert] = useState({ show: false, title: '', message: '' })
  const barcodeInputRef = useRef(null)
  const autoSaveTimerRef = useRef(null)
  const skipNextAutoSaveRef = useRef(true)

  const loadOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/api/sales/orders/${id}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.message || 'Failed to load order.')
      setOrder(data)
      const initialBoxes = Math.max(1, Number(data?.noOfPackedBoxes) || 1)
      setNoOfPackedBoxes(initialBoxes)
      setSavedPackedBoxes(initialBoxes)
      setLastPrintedBoxCount(initialBoxes)
      setBoxUpdateCount(initialBoxes)
    } catch (e) {
      setError(e.message || 'Failed to load order.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
    loadPackerCounts()
  }, [id])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  const loadPackerCounts = async () => {
    try {
      const res = await api.get('/api/sales/orders')
      const data = await res.json().catch(() => [])
      if (!res.ok) return
      const rows = Array.isArray(data) ? data : []
      const nextCounts = {
        all: rows.length,
        processed: 0,
        'add-on': 0,
        packed: 0,
        'add-on-packed': 0,
      }
      rows.forEach((row) => {
        const status = String(row?.status || '')
        if (Object.prototype.hasOwnProperty.call(nextCounts, status)) {
          nextCounts[status] += 1
        }
      })
      setPackerCounts(nextCounts)
    } catch {
      // Ignore count strip failures on detail page.
    }
  }

  const updatePackedQty = (idx, value, extra = {}) => {
    setOrder((prev) => {
      const lines = Array.isArray(prev?.lineItems) ? [...prev.lineItems] : []
      if (!lines[idx]) return prev
      const ordered = Math.max(0, Number(lines[idx].qty) || 0)
      const currentStock = Math.max(0, Number(lines[idx].currentStock) || 0)
      const parsedQty = Math.trunc(Number(value) || 0)
      const packedQty = Math.max(0, Math.min(ordered, parsedQty))
      if (packedQty > currentStock) {
        setError('Current stock of the product is less then packed qty.')
        return prev
      }
      lines[idx] = {
        ...lines[idx],
        packedQty,
        ...((lines[idx].manualEntry || extra.manualEntry === true) ? { manualEntry: true } : {}),
        ...(typeof extra.isExchange === 'boolean' ? { isExchange: extra.isExchange } : {}),
        ...(typeof extra.isFreeItem === 'boolean' ? { isFreeItem: extra.isFreeItem } : {}),
        ...(extra.barcode ? { barcode: String(extra.barcode).trim().slice(0, 100) } : {}),
      }
      return { ...prev, lineItems: lines }
    })
  }

  const lineKey = (line) => `${String(line?.productId || '').trim()}__${String(line?.unitType || '').trim() || 'Piece'}`
  const isAddonPackingMode = order?.status === 'add-on'
  const packableLineItems = useMemo(() => {
    const lines = Array.isArray(order?.lineItems) ? order.lineItems : []
    if (!isAddonPackingMode) return lines
    return lines.filter((line) => line?.isAddedLater)
  }, [order, isAddonPackingMode])

  const normalized = (value) => String(value || '').trim().toLowerCase()

  const findMatchingLineIndex = (barcodeValue, selectedKey) => {
    const normalizedBarcode = normalized(barcodeValue)
    if (!normalizedBarcode) return -1
    const lines = Array.isArray(order?.lineItems) ? order.lineItems : []
    const selectedLine = selectedKey ? lines.find((l) => lineKey(l) === selectedKey) : null
    if (selectedLine) {
      const selectedBarcode = normalized(selectedLine.barcode)
      if (
        selectedBarcode === normalizedBarcode &&
        (!isAddonPackingMode || selectedLine?.isAddedLater)
      ) {
        return lines.findIndex((l) => lineKey(l) === selectedKey)
      }
      return -1
    }
    return lines.findIndex((l) => {
      if (isAddonPackingMode && !l?.isAddedLater) return false
      const lineBarcode = normalized(l.barcode)
      return lineBarcode === normalizedBarcode
    })
  }

  const showScanAlert = (title, message) => {
    setScanAlert({ show: true, title, message })
    setScanMessage('')
  }

  const applyPackedQtyToLine = (idx, qty, barcode) => {
    const line = order?.lineItems?.[idx]
    if (!line) return
    const ordered = Math.max(0, Number(line?.qty) || 0)
    const currentStock = Math.max(0, Number(line?.currentStock) || 0)
    const currentPacked = Math.max(0, Number(line?.packedQty) || 0)
    if (currentPacked + qty > ordered) {
      showScanAlert(
        'Qty Exceeded',
        `Ship qty can not be more than ordered qty. Ordered: ${ordered}, Packed: ${currentPacked}, Trying: +${qty}.`,
      )
      return
    }
    if (currentPacked + qty > currentStock) {
      showScanAlert('Stock Too Low', 'Current stock of the product is less then packed qty.')
      return
    }
    const nextPacked = currentPacked + qty
    updatePackedQty(idx, nextPacked, {
      isExchange: scanIsExchange,
      isFreeItem: scanIsFreeItem,
      barcode,
    })
    setScanMessage(`Scanned ${line?.productName || line?.productId || 'item'} (+${qty}).`)
    setScanBarcode('')
    barcodeInputRef.current?.focus()
  }

  const lookupBarcodeInSystem = async (barcode) => {
    const res = await api.get(`/api/sales/barcode-lookup?value=${encodeURIComponent(barcode)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Failed to validate barcode.')
    return data
  }

  const findLineByProduct = (productId, unitType, selectedKey) => {
    const lines = Array.isArray(order?.lineItems) ? order.lineItems : []
    const hasUnitType = !!normalized(unitType)
    if (selectedKey) {
      const selectedIdx = lines.findIndex((l) => lineKey(l) === selectedKey)
      if (selectedIdx < 0) return { idx: -1, selectedIdx: -1 }
      const selectedLine = lines[selectedIdx]
      const selectedMatchesProduct =
        normalized(selectedLine.productId) === normalized(productId) &&
        (!unitType || normalized(selectedLine.unitType) === normalized(unitType)) &&
        (!isAddonPackingMode || selectedLine?.isAddedLater)
      return { idx: selectedMatchesProduct ? selectedIdx : -1, selectedIdx }
    }
    const withUnitIdx = lines.findIndex(
      (l) =>
        (!isAddonPackingMode || l?.isAddedLater) &&
        normalized(l.productId) === normalized(productId) &&
        (!unitType || normalized(l.unitType) === normalized(unitType)),
    )
    if (withUnitIdx >= 0) return { idx: withUnitIdx, selectedIdx: -1 }
    if (hasUnitType) return { idx: -1, selectedIdx: -1 }
    const byProductIdx = lines.findIndex(
      (l) => (!isAddonPackingMode || l?.isAddedLater) && normalized(l.productId) === normalized(productId),
    )
    return { idx: byProductIdx, selectedIdx: -1 }
  }

  const handleScanSubmit = async (event) => {
    event.preventDefault()
    if (['packed', 'add-on-packed'].includes(order?.status)) {
      setScanMessage('Packed order is locked. You can only update box count and print stickers.')
      return
    }
    const barcode = String(scanBarcode || '').trim()
    const qty = Math.max(1, Math.trunc(Number(scanQty) || 1))
    if (!barcode) {
      setScanMessage('Please scan or enter a barcode.')
      return
    }
    const directMatchIdx = findMatchingLineIndex(barcode, scanProductKey)
    if (directMatchIdx >= 0) {
      applyPackedQtyToLine(directMatchIdx, qty, barcode)
      return
    }

    try {
      const lookup = await lookupBarcodeInSystem(barcode)
      if (!lookup?.exists) {
        showScanAlert('Barcode Does Not Exist', `Barcode "${barcode}" does not exist in our system.`)
        setScanBarcode('')
        return
      }

      const { idx, selectedIdx } = findLineByProduct(lookup.productId, lookup.unitType, scanProductKey)
      if (idx < 0) {
        const selectedLine = selectedIdx >= 0 ? order?.lineItems?.[selectedIdx] : null
        const selectedName = selectedLine
          ? `${selectedLine.productId} - ${selectedLine.productName}`
          : 'this order'
        showScanAlert(
          'Wrong Product',
          `Scanned item: ${lookup.productId} - ${lookup.productName}${lookup.unitType ? ` (${lookup.unitType})` : ''}. This item does not match ${selectedName}.`,
        )
        setScanBarcode('')
        return
      }
      applyPackedQtyToLine(idx, qty, barcode)
    } catch (e) {
      setError(e.message || 'Failed to validate barcode.')
    }
  }

  const handleAddFromProductSelector = () => {
    if (['packed', 'add-on-packed'].includes(order?.status)) {
      setScanMessage('Packed order is locked. You can only update box count and print stickers.')
      return
    }
    const qty = Math.max(1, Math.trunc(Number(scanQty) || 1))
    if (!scanProductKey) {
      showScanAlert('Product Required', 'Please select a product before clicking Add.')
      return
    }
    const idx = (order?.lineItems || []).findIndex((l) => lineKey(l) === scanProductKey)
    if (idx < 0) {
      showScanAlert('Wrong Product', 'Selected product was not found in this order.')
      return
    }
    const line = order?.lineItems?.[idx]
    if (!line) return
    const ordered = Math.max(0, Number(line?.qty) || 0)
    const currentStock = Math.max(0, Number(line?.currentStock) || 0)
    const currentPacked = Math.max(0, Number(line?.packedQty) || 0)
    if (currentPacked + qty > ordered) {
      showScanAlert(
        'Qty Exceeded',
        `Ship qty can not be more than ordered qty. Ordered: ${ordered}, Packed: ${currentPacked}, Trying: +${qty}.`,
      )
      return
    }
    if (currentPacked + qty > currentStock) {
      showScanAlert('Stock Too Low', 'Current stock of the product is less then packed qty.')
      return
    }
    const nextPacked = currentPacked + qty
    updatePackedQty(idx, nextPacked, {
      manualEntry: true,
      isExchange: scanIsExchange,
      isFreeItem: scanIsFreeItem,
      barcode: 'Manually added',
    })
    setScanMessage(`Manually added ${line?.productName || line?.productId || 'item'} (+${qty}).`)
  }

  const savePacking = async (boxCount = noOfPackedBoxes, options = {}) => {
    if (!order) return
    const sanitizedBoxCount = Math.max(1, Number(boxCount) || 1)
    const silentLog = options?.silentLog === true
    setSaving(true)
    setError('')
    const packedItems = (order.lineItems || []).map((l) => ({
      productId: l.productId,
      unitType: l.unitType,
      packedQty: Math.max(0, Number(l.packedQty) || 0),
      barcode: String(l.barcode || '').trim().slice(0, 100),
      manualEntry: l.manualEntry === true,
    }))
    const res = await api.patch(`/api/sales/orders/${order._id}/packing`, {
      packedItems,
      noOfPackedBoxes: sanitizedBoxCount,
      silentLog,
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data?.message || 'Failed to save packing.')
      return
    }
    setOrder(data)
    const savedCount = Math.max(1, Number(data?.noOfPackedBoxes) || 1)
    setNoOfPackedBoxes(savedCount)
    setSavedPackedBoxes(savedCount)
    setBoxUpdateCount(savedCount)
    skipNextAutoSaveRef.current = true
  }

  const markPacked = async () => {
    if (!order) return
    const packedQtyTotal = Array.isArray(order?.lineItems)
      ? order.lineItems.reduce((sum, line) => sum + Math.max(0, Number(line?.packedQty) || 0), 0)
      : 0
    if (packedQtyTotal <= 0) {
      setError('At least one item must be packed before marking this order packed.')
      return
    }
    await savePacking()
    const res = await api.patch(`/api/sales/orders/${order._id}/workflow`, { action: 'mark_packed' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.message || 'Failed to pack order.')
      return
    }
    setOrder(data)
  }

  const printBoxBarcodes = (startBox = 1, endBox = noOfPackedBoxes) => {
    if (!order) return
    const orderNo = String(order.orderNumber || '').trim()
    const orderNoLast4 = orderNo ? orderNo.slice(-4) : ''
    const customerId = String(
      order.customer?.customerNumber || order.customer?.customerId || order.customer?._id || '',
    ).trim() || '-'
    const shippingAddress = String(order.shippingAddress || '').trim() || '-'
    const salesPersonName = String(
      order.salesPerson?.name || order.salesPerson?.username || '',
    ).trim() || '-'
    const safeStart = Math.max(1, Number(startBox) || 1)
    const safeEnd = Math.max(safeStart, Number(endBox) || safeStart)
    const rows = []
    for (let i = safeStart; i <= safeEnd; i += 1) {
      const boxValue = `${orderNo}/${i}`
      rows.push(`
        <div class="sticker">
          <div class="sticker-card">
            <div class="sticker-header">${customerId}</div>
            <div class="order-no">${orderNoLast4 || orderNo || '-'}</div>
            <div class="box-meta">Box ${i} of ${noOfPackedBoxes}</div>
            <div class="barcode-wrap">
              <svg id="box-barcode-${i}"></svg>
            </div>
            <div class="address-block">${shippingAddress}</div>
            <div class="sales-footer">Sales Person: ${salesPersonName}</div>
          </div>
        </div>
      `)
    }
    const w = window.open('', '_blank', 'width=900,height=850')
    if (!w) return
    w.document.write(`
      <html>
        <head>
          <title>${orderNo || 'Box Stickers'}</title>
          <style>
            @page {
              size: 4in 6in;
              margin: 0;
            }
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
              align-items: center;
              justify-content: flex-start;
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
          ${rows.join('')}
          <script>
            window.__barcodeReady = false;
            function renderAndPrint() {
              if (window.__barcodeReady) return;
              if (typeof JsBarcode !== 'function') return;
              window.__barcodeReady = true;
              ${Array.from({ length: safeEnd - safeStart + 1 }, (_, offset) => {
                const boxNumber = safeStart + offset
                const boxValue = `${orderNo}/${boxNumber}`
                return `try { JsBarcode('#box-barcode-${boxNumber}', ${JSON.stringify(boxValue)}, { format:'CODE128', width:2.6, height:120, margin:0, displayValue:true, fontSize:28, fontOptions:'bold', textMargin:8 }); } catch (e) {}`
              }).join('\n')}
              requestAnimationFrame(() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 180);
              });
            }
            window.addEventListener('load', () => setTimeout(renderAndPrint, 50));
          </script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" onload="renderAndPrint()"></script>
        </body>
      </html>
    `)
    w.document.close()
  }

  const handlePrintBoxBarcodes = () => {
    if (!isPackedLocked) return
    if (noOfPackedBoxes > lastPrintedBoxCount) {
      printBoxBarcodes(lastPrintedBoxCount + 1, noOfPackedBoxes)
      setLastPrintedBoxCount(noOfPackedBoxes)
      return
    }
    printBoxBarcodes(1, noOfPackedBoxes)
  }

  const openUpdateBoxesModal = () => {
    setBoxUpdateCount(Math.max(1, Number(noOfPackedBoxes) || 1))
    setShowBoxUpdateModal(true)
  }

  const handleUpdateBoxes = async () => {
    const prevSaved = Math.max(1, Number(savedPackedBoxes) || 1)
    const nextCount = Math.max(1, Number(boxUpdateCount) || 1)
    await savePacking(nextCount)
    setShowBoxUpdateModal(false)
    if (nextCount > prevSaved) {
      printBoxBarcodes(prevSaved + 1, nextCount)
      setLastPrintedBoxCount(nextCount)
    }
  }

  const printOrder = () => {
    if (!order) return
    const w = window.open('', '_blank', 'width=950,height=800')
    if (!w) return
    const orderNo = String(order.orderNumber || '')
    w.document.write(`
      <html>
        <head>
          <title>${orderNo || 'Order'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 18px;
              color: #0f172a;
            }
            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin-bottom: 10px;
            }
            .print-title {
              margin: 0;
              font-size: 24px;
              font-weight: 800;
            }
            .print-meta {
              margin: 10px 0 14px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px 12px;
              background: #f8fafc;
              line-height: 1.45;
              font-size: 14px;
            }
            .print-meta strong {
              color: #1e293b;
            }
            .print-address {
              margin-top: 8px;
              border-top: 1px dashed #94a3b8;
              padding-top: 8px;
              white-space: pre-wrap;
              word-break: break-word;
            }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            .print-table th {
              background: #1e293b;
              color: #fff;
              padding: 8px;
              border: 1px solid #334155;
              text-align: left;
            }
            .print-table td {
              border: 1px solid #cbd5e1;
              padding: 7px 8px;
              vertical-align: top;
            }
            .text-end {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h3 class="print-title">Order ${orderNo}</h3>
            <svg id="order-barcode"></svg>
          </div>
          <div class="print-meta">
            <div><strong>Status:</strong> ${order.status || ''}</div>
            <div><strong>Customer:</strong> ${order.customer?.customerName || order.customer?.businessName || ''}</div>
            <div><strong>Sales Person:</strong> ${order.salesPerson?.name || order.salesPerson?.username || ''}</div>
            <div><strong>Shipping Type:</strong> ${order.shippingType || '-'}</div>
            <div class="print-address"><strong>Shipping Address:</strong><br/>${order.shippingAddress || '-'}</div>
          </div>
          <table class="print-table">
            <thead><tr><th>ID</th><th>Product</th><th>Unit</th><th class="text-end">Ordered Qty</th></tr></thead>
            <tbody>
              ${(order.lineItems || []).map((l) => `<tr><td>${l.productId || ''}</td><td>${l.productName || ''}</td><td>${l.unitType || ''}</td><td class="text-end">${Number(l.qty || 0)}</td></tr>`).join('')}
            </tbody>
          </table>
          <script>
            window.__orderBarcodeReady = false;
            function renderAndPrintOrder() {
              if (window.__orderBarcodeReady) return;
              if (typeof JsBarcode !== 'function') return;
              window.__orderBarcodeReady = true;
              try {
                JsBarcode('#order-barcode', ${JSON.stringify(orderNo)}, {
                  format: 'CODE128',
                  width: 2,
                  height: 40,
                  displayValue: true,
                  margin: 0,
                });
              } catch (e) {}
              requestAnimationFrame(() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 120);
              });
            }
            window.addEventListener('load', () => setTimeout(renderAndPrintOrder, 50));
          </script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" onload="renderAndPrintOrder()"></script>
        </body>
      </html>
    `)
    w.document.close()
  }

  const printAddOn = () => {
    if (!order) return
    const lines = (order.lineItems || []).filter((l) => l?.isAddedLater)
    if (lines.length === 0) {
      setError('No add-on items available to print.')
      return
    }
    const w = window.open('', '_blank', 'width=950,height=800')
    if (!w) return
    const orderNo = String(order.orderNumber || '')
    w.document.write(`
      <html>
        <head>
          <title>${orderNo || 'Add-On'}</title>
        </head>
        <body style="font-family:Arial;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
            <h3 style="margin:0;">Add-On Items - Order ${orderNo}</h3>
            <svg id="order-barcode"></svg>
          </div>
          <div>Status: ${order.status || ''}</div>
          <div>Customer: ${order.customer?.customerName || order.customer?.businessName || ''}</div>
          <div>Sales Person: ${order.salesPerson?.name || order.salesPerson?.username || ''}</div>
          <hr/>
          <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">
            <thead><tr><th>ID</th><th>Product</th><th>Unit</th><th>Add-On Qty</th><th>Packed Qty</th></tr></thead>
            <tbody>
              ${lines.map((l) => `<tr><td>${l.productId || ''}</td><td>${l.productName || ''}</td><td>${l.unitType || ''}</td><td>${Number(l.qty || 0)}</td><td>${Number(l.packedQty || 0)}</td></tr>`).join('')}
            </tbody>
          </table>
          <script>
            window.__orderBarcodeReady = false;
            function renderOrderAndPrint() {
              if (window.__orderBarcodeReady) return;
              if (typeof JsBarcode !== 'function') return;
              window.__orderBarcodeReady = true;
              try { JsBarcode('#order-barcode', ${JSON.stringify(orderNo)}, { format:'CODE128', width:2, height:40, displayValue:true }); } catch (e) {}
              requestAnimationFrame(() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 180);
              });
            }
            window.addEventListener('load', () => setTimeout(renderOrderAndPrint, 50));
          </script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" onload="renderOrderAndPrint()"></script>
        </body>
      </html>
    `)
    w.document.close()
  }

  const totals = useMemo(() => {
    const lines = Array.isArray(order?.lineItems) ? order.lineItems : []
    return lines.reduce(
      (acc, l) => {
        const ordered = Math.max(0, Number(l.qty) || 0)
        const packed = Math.max(0, Number(l.packedQty) || 0)
        const pieces = Math.max(0, Number(l.qtyPerUnit) || 1) * packed
        acc.ordered += ordered
        acc.packed += packed
        acc.pieces += pieces
        return acc
      },
      { ordered: 0, packed: 0, pieces: 0 },
    )
  }, [order])

  const visibleTotals = useMemo(() => {
    return packableLineItems.reduce(
      (acc, l) => {
        const ordered = Math.max(0, Number(l.qty) || 0)
        const packed = Math.max(0, Number(l.packedQty) || 0)
        const pieces = Math.max(0, Number(l.qtyPerUnit) || 1) * packed
        acc.ordered += ordered
        acc.packed += packed
        acc.pieces += pieces
        return acc
      },
      { ordered: 0, packed: 0, pieces: 0 },
    )
  }, [packableLineItems])

  const selectableLineItems = useMemo(() => {
    return packableLineItems.filter((line) => {
      const ordered = Math.max(0, Number(line?.qty) || 0)
      const packed = Math.max(0, Number(line?.packedQty) || 0)
      return packed < ordered
    })
  }, [packableLineItems])

  const isPackedLocked = ['packed', 'add-on-packed'].includes(order?.status)
  const hasAnyPackedQty = visibleTotals.packed > 0
  const canPrintBoxBarcode = isPackedLocked

  useEffect(() => {
    if (!scanProductKey) return
    const stillSelectable = selectableLineItems.some((line) => lineKey(line) === scanProductKey)
    if (!stillSelectable) {
      setScanProductKey('')
    }
  }, [scanProductKey, selectableLineItems])

  const packedSnapshot = useMemo(() => {
    if (!order?._id) return ''
    const packedItems = (order.lineItems || [])
      .map((l) => ({
        productId: l.productId,
        unitType: l.unitType,
        packedQty: Math.max(0, Math.trunc(Number(l.packedQty) || 0)),
        manualEntry: l.manualEntry === true,
      }))
      .sort((a, b) => `${a.productId}__${a.unitType}`.localeCompare(`${b.productId}__${b.unitType}`))
    return JSON.stringify({
      orderId: order._id,
      noOfPackedBoxes: Math.max(1, Math.trunc(Number(noOfPackedBoxes) || 1)),
      packedItems,
    })
  }, [order?._id, order?.lineItems, noOfPackedBoxes])

  useEffect(() => {
    if (!order?._id) return
    if (isPackedLocked) return
    if (!packedSnapshot) return
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      return
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      savePacking(noOfPackedBoxes, { silentLog: true })
    }, 450)
  }, [packedSnapshot, isPackedLocked])

  if (loading) return <p>Loading order...</p>
  if (!order) return <Alert variant="danger">{error || 'Order not found.'}</Alert>

  return (
    <div className="packer-order-open-page">
      {error && <Alert variant="danger">{error}</Alert>}
      {isAddonPackingMode && (
        <Alert variant="info" className="py-2">
          Add-on mode: only add-on items are visible here and need to be packed.
        </Alert>
      )}
      <Card className="mb-3 packer-top-strip">
        <Card.Body className="d-flex flex-wrap gap-3 align-items-center">
          <Button size="sm" variant="light" className="packer-top-link-btn" onClick={() => navigate('/')}>
            All Orders
          </Button>
          <div className="packer-top-stat"><span>Total Orders</span><strong>{packerCounts.all}</strong></div>
          <div className="packer-top-stat"><span>Add-On</span><strong>{packerCounts['add-on']}</strong></div>
          <div className="packer-top-stat"><span>Add-On-Packed</span><strong>{packerCounts['add-on-packed']}</strong></div>
          <div className="packer-top-stat"><span>Packed</span><strong>{packerCounts.packed}</strong></div>
          <div className="packer-top-stat"><span>Processed</span><strong>{packerCounts.processed}</strong></div>
        </Card.Body>
      </Card>
      <Card className="mb-3 packer-order-card">
        <Card.Header>
          <h4 className="mb-0">
            Order Details - <strong>{order.orderNumber}</strong>{' '}
            <Badge bg="primary">{order.status}</Badge>{' '}
            <Badge bg="warning" text="dark">{order.shippingType || '-'}</Badge>
          </h4>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={2}><Form.Label>Order Date</Form.Label><Form.Control value={order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''} readOnly /></Col>
            <Col md={2}><Form.Label>Sales Person</Form.Label><Form.Control value={order.salesPerson?.name || order.salesPerson?.username || ''} readOnly /></Col>
            <Col md={4}><Form.Label>Customer</Form.Label><Form.Control value={order.customer?.customerName || order.customer?.businessName || ''} readOnly /></Col>
            <Col md={4}><Form.Label>Shipping Address</Form.Label><Form.Control value={order.shippingAddress || ''} readOnly /></Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3 packer-order-card">
        <Card.Body>
          <Form onSubmit={handleScanSubmit}>
            <Row className="g-3 align-items-end">
              <Col md={2}>
                <Form.Label>Quantity *</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  step={1}
                  value={scanQty}
                  disabled={isPackedLocked}
                  onChange={(e) => setScanQty(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                />
              </Col>
              <Col md={2}>
                <Form.Check
                  type="checkbox"
                  id="scan-is-exchange"
                  label="Is Exchange"
                  checked={scanIsExchange}
                  disabled={isPackedLocked}
                  onChange={(e) => setScanIsExchange(e.target.checked)}
                />
              </Col>
              <Col md={2}>
                <Form.Check
                  type="checkbox"
                  id="scan-is-free-item"
                  label="Is Free Item"
                  checked={scanIsFreeItem}
                  disabled={isPackedLocked}
                  onChange={(e) => setScanIsFreeItem(e.target.checked)}
                />
              </Col>
              <Col md={3}>
                <Form.Label>Enter Barcode</Form.Label>
                <Form.Control
                  ref={barcodeInputRef}
                  value={scanBarcode}
                  disabled={isPackedLocked}
                  onChange={(e) => setScanBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleScanSubmit(e)
                  }}
                  placeholder="Scan barcode and press Enter"
                />
              </Col>
              <Col md={3}>
                <Form.Label>Product *</Form.Label>
                <Form.Select
                  className="packer-product-select"
                  value={scanProductKey}
                  disabled={isPackedLocked}
                  onChange={(e) => setScanProductKey(e.target.value)}
                >
                  <option value="">-Select-</option>
                  {selectableLineItems.map((l, idx) => (
                    <option key={`${lineKey(l)}-${idx}`} value={lineKey(l)}>
                      {l.productId} - {l.productName}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
            <div className="mt-3 d-flex gap-2">
              <Button type="submit" variant="primary" disabled={isPackedLocked}>Add by Scan</Button>
              <Button type="button" variant="outline-primary" onClick={handleAddFromProductSelector} disabled={isPackedLocked}>Add</Button>
            </div>
          </Form>
          {scanMessage && <Alert variant="success" className="mt-3 mb-0 py-2">{scanMessage}</Alert>}
        </Card.Body>
      </Card>

      <Card className="mb-3 packer-order-card">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 packer-order-table" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>Image</th>
                <th>ID</th>
                <th>Product Name</th>
                <th>Unit</th>
                <th className="text-end">Ordered Qty</th>
                <th>Barcode</th>
                <th className="text-end">Packed Qty</th>
                <th className="text-end">Not Packed Qty</th>
                <th className="text-end">Total Pieces</th>
                <th className="text-end">Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {packableLineItems.map((l, idx) => {
                const ordered = Math.max(0, Number(l.qty) || 0)
                const packed = Math.max(0, Number(l.packedQty) || 0)
                const remain = Math.max(0, ordered - packed)
                const pieces = Math.max(0, Number(l.qtyPerUnit) || 1) * packed
                const hasBeenAddedForPacking = l.manualEntry === true || !!String(l.barcode || '').trim() || packed > 0
                const rowClassName = l.manualEntry
                  ? 'packer-manual-row'
                  : (packed < ordered ? 'packer-partial-row' : '')
                return (
                  <tr
                    key={`${l.productId}-${l.unitType}-${idx}`}
                    className={rowClassName}
                  >
                    <td>
                      <div className="packer-image-thumb">
                        {l.imageUrl ? (
                          <img
                            src={l.imageUrl}
                            alt=""
                            className="packer-image-thumb-img"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                        <div className="packer-image-fallback" aria-hidden />
                      </div>
                    </td>
                    <td>{l.productId}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span>{l.productName}</span>
                        {l.isAddedLater && <Badge bg="primary">Add-On</Badge>}
                      </div>
                    </td>
                    <td>{l.unitType}</td>
                    <td className="text-end">{ordered}</td>
                    <td>{l.manualEntry ? 'Manually added' : (l.barcode || '-')}</td>
                    <td className="text-end" style={{ width: 120 }}>
                      <Form.Control
                        className="packer-packed-qty-input text-center"
                        size="sm"
                        type="number"
                        min={0}
                        max={ordered}
                        step={1}
                        value={packed}
                        disabled={isPackedLocked || !hasBeenAddedForPacking}
                        onChange={(e) => updatePackedQty(idx, e.target.value)}
                      />
                    </td>
                    <td className="text-end">{remain}</td>
                    <td className="text-end">{pieces}</td>
                    <td className="text-end packer-current-stock-cell">
                      {l.currentStock != null ? `${Number(l.currentStock).toFixed(2)} ${l.unitType || ''}` : 'N/A'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-end"><strong>Totals</strong></td>
                <td className="text-end"><strong>{visibleTotals.ordered}</strong></td>
                <td />
                <td className="text-end"><strong>{visibleTotals.packed}</strong></td>
                <td className="text-end"><strong>{Math.max(0, visibleTotals.ordered - visibleTotals.packed)}</strong></td>
                <td className="text-end"><strong>{visibleTotals.pieces}</strong></td>
                <td />
              </tr>
            </tfoot>
          </Table>
        </Card.Body>
      </Card>

      <Card className="packer-order-card">
        <Card.Footer className="d-flex flex-wrap gap-2 justify-content-end packer-order-footer">
          <Button variant="primary" onClick={printOrder}>Print Order</Button>
          {isAddonPackingMode && <Button variant="outline-primary" onClick={printAddOn}>Print Add-On</Button>}
          {!isPackedLocked && (
            <div className="d-flex align-items-center gap-2">
              <Form.Label className="mb-0">No. of Packed Boxes *</Form.Label>
              <Form.Select
                value={noOfPackedBoxes}
                onChange={(e) => setNoOfPackedBoxes(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 90 }}
              >
                {Array.from({ length: 200 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Form.Select>
            </div>
          )}
          {canPrintBoxBarcode && (
            <Button variant="warning" onClick={handlePrintBoxBarcodes}>
              Print Box Barcode
            </Button>
          )}
          {isPackedLocked && (
            <Button variant="outline-success" onClick={openUpdateBoxesModal} disabled={saving}>
              Update Boxes
            </Button>
          )}
          <Button variant="success" onClick={markPacked} disabled={saving || isPackedLocked || !hasAnyPackedQty}>
            {saving ? 'Saving...' : 'Pack'}
          </Button>
          <Button variant="dark" onClick={() => setShowLogModal(true)}>View Log</Button>
          <Button variant="secondary" onClick={() => navigate('/')}>Back</Button>
        </Card.Footer>
      </Card>

      <Modal show={showLogModal} onHide={() => setShowLogModal(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Order Log</Modal.Title></Modal.Header>
        <Modal.Body>
          <Table bordered size="sm" className="mb-0">
            <thead>
              <tr><th>Action By</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {(order.logs || []).slice().reverse().map((l, idx) => (
                <tr key={`${idx}-${l.at || ''}`}>
                  <td>{l.byUserName || 'User'}</td>
                  <td>{l.at ? new Date(l.at).toLocaleString() : '-'}</td>
                  <td>{l.action || '-'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowLogModal(false)}>Close</Button></Modal.Footer>
      </Modal>

      <Modal
        show={showBoxUpdateModal}
        onHide={() => setShowBoxUpdateModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Update Packed Boxes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label>No. of Packed Boxes *</Form.Label>
          <Form.Select
            value={boxUpdateCount}
            onChange={(e) => setBoxUpdateCount(Math.max(1, Number(e.target.value) || 1))}
          >
            {Array.from({ length: 200 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Form.Select>
          {boxUpdateCount > savedPackedBoxes && (
            <div className="mt-2 text-muted small">
              Incremental stickers will print first for new boxes ({savedPackedBoxes + 1} to {boxUpdateCount}).
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBoxUpdateModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleUpdateBoxes} disabled={saving}>
            {saving ? 'Saving...' : 'Save Boxes'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={scanAlert.show}
        onHide={() => setScanAlert({ show: false, title: '', message: '' })}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{scanAlert.title || 'Scan Error'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <div className="text-danger" style={{ fontSize: 84, lineHeight: 1, fontWeight: 700 }}>X</div>
          <div className="mt-2">{scanAlert.message || 'Something went wrong while scanning.'}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setScanAlert({ show: false, title: '', message: '' })
              barcodeInputRef.current?.focus()
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default PackerOrderOpenPage
