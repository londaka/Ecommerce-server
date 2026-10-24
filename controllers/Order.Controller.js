import { createHmac, randomBytes } from "crypto";
import mongoose from "mongoose";
import { Address } from "../models/Address.js";
import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import sendOrderConfirmation from "../utils/sendOrderConfirmation.js";
import TryCatch from "../utils/TryCatch.js";

const getEsewaConfig = () => {
    const mode = process.env.ESEWA_MODE || "uat";
    const productCode = process.env.ESEWA_PRODUCT_CODE || (mode === "uat" ? "EPAYTEST" : "");
    const secretKey = process.env.ESEWA_SECRET_KEY || (mode === "uat" ? "8gBm/:&EnhH.1/q" : "");

    if (!["uat", "production"].includes(mode)) {
        throw new Error("ESEWA_MODE must be either 'uat' or 'production'");
    }

    if (!secretKey) {
        throw new Error("ESEWA_SECRET_KEY must be configured before accepting eSewa payments");
    }

    if (!productCode) {
        throw new Error("ESEWA_PRODUCT_CODE must be configured for production payments");
    }

    return {
        productCode,
        secretKey,
        formUrl: mode === "production"
            ? "https://epay.esewa.com.np/api/epay/main/v2/form"
            : "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
        statusUrl: mode === "production"
            ? "https://esewa.com.np/api/epay/transaction/status/"
            : "https://rc.esewa.com.np/api/epay/transaction/status/",
    };
};

const getCheckoutCart = async(userId) => {
    const cart = await Cart.find({ user: userId }).populate({
        path: "product",
        select: "title price stock"
    });

    if (!cart.length) {
        return { error: "Cart is empty" };
    }

    for (const item of cart) {
        if (!item.product) {
            return { error: "A product in your cart is no longer available" };
        }
        if (item.product.stock < item.quantity) {
            return { error: `${item.product.title} is out of stock` };
        }
    }

    const totalAmount = (
        Math.round(cart.reduce((total, item) => total + item.product.price * item.quantity, 0) * 100) / 100
    ).toFixed(2);
    if (Number(totalAmount) <= 0) {
        return { error: "The cart total must be greater than zero" };
    }

    return { cart, totalAmount };
};

const getPlacedOrdersFilter = () => ({
    $or: [
        { method: { $ne: "esewa" } },
        { paymentStatus: "paid" }
    ]
});

const finalizePaidOrder = async(order, user, paymentInfo) => {
    const updatedOrder = await Order.findOneAndUpdate(
        { _id: order._id, user: user._id, paymentStatus: "pending" },
        {
            $set: {
                paymentStatus: "paid",
                paymentInfo,
                paidAt: new Date().toISOString()
            }
        },
        { new: true }
    );

    if (!updatedOrder) {
        return null;
    }

    for (const item of updatedOrder.items) {
        await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: -item.quantity, sold: item.quantity }
        });
        const cartItem = await Cart.findOne({
            user: user._id,
            product: item.product
        });
        if (cartItem && cartItem.quantity <= item.quantity) {
            await cartItem.deleteOne();
        } else if (cartItem) {
            cartItem.quantity -= item.quantity;
            await cartItem.save();
        }
    }

    const products = await Promise.all(updatedOrder.items.map(async(item) => {
        const product = await Product.findById(item.product).select("title price");
        return {
            name: product?.title || "Product",
            price: product?.price || 0,
            quantity: item.quantity
        };
    }));

    try {
        await sendOrderConfirmation({
            email: user.email,
            subject: "Order Confirmation",
            orderId: updatedOrder._id,
            products,
            totalAmount: updatedOrder.subTotal
        });
    } catch (error) {
        console.error("Payment succeeded, but the order confirmation email failed:", error);
    }

    return updatedOrder;
};

export const initiateEsewaPayment = TryCatch(async(req, res) => {
    const { addressId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return res.status(400).json({ message: "A valid delivery address is required" });
    }

    const address = await Address.findOne({
        _id: addressId,
        user: req.user._id
    });

    if (!address) {
        return res.status(404).json({ message: "Address not found" });
    }

    const checkout = await getCheckoutCart(req.user._id);
    if (checkout.error) {
        return res.status(400).json({ message: checkout.error });
    }
    const { cart, totalAmount } = checkout;
    const { productCode, secretKey, formUrl } = getEsewaConfig();

    const transactionUUID = `${Date.now()}-${randomBytes(8).toString("hex")}`;
    const items = cart.map((item) => ({
        product: item.product._id,
        quantity: item.quantity
    }));
    const order = await Order.create({
        items,
        method: "esewa",
        paymentStatus: "pending",
        transactionUUID,
        user: req.user._id,
        phone: address.phone,
        address: address.address,
        subTotal: Number(totalAmount)
    });

    const signedFieldNames = "total_amount,transaction_uuid,product_code";
    const signatureMessage = `total_amount=${totalAmount},transaction_uuid=${transactionUUID},product_code=${productCode}`;
    const signature = createHmac("sha256", secretKey)
        .update(signatureMessage)
        .digest("base64");
    const frontendUrl = (process.env.ESEWA_FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const returnUrl = `${frontendUrl}/payment/result?orderId=${order._id}`;

    res.json({
        gatewayUrl: formUrl,
        fields: {
            amount: totalAmount,
            tax_amount: "0",
            total_amount: totalAmount,
            transaction_uuid: transactionUUID,
            product_code: productCode,
            product_service_charge: "0",
            product_delivery_charge: "0",
            success_url: returnUrl,
            failure_url: returnUrl,
            signed_field_names: signedFieldNames,
            signature
        }
    });
});

export const completeDemoPayment = TryCatch(async(req, res) => {
    if (process.env.DEMO_PAYMENTS !== "true" || process.env.NODE_ENV === "production") {
        return res.status(404).json({ message: "Demo payments are not enabled" });
    }

    const { addressId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return res.status(400).json({ message: "A valid delivery address is required" });
    }

    const address = await Address.findOne({
        _id: addressId,
        user: req.user._id
    });
    if (!address) {
        return res.status(404).json({ message: "Address not found" });
    }

    const checkout = await getCheckoutCart(req.user._id);
    if (checkout.error) {
        return res.status(400).json({ message: checkout.error });
    }
    const { cart, totalAmount } = checkout;

    const order = await Order.create({
        items: cart.map((item) => ({
            product: item.product._id,
            quantity: item.quantity
        })),
        method: "demo",
        paymentStatus: "pending",
        user: req.user._id,
        phone: address.phone,
        address: address.address,
        subTotal: Number(totalAmount)
    });

    const completedOrder = await finalizePaidOrder(order, req.user, "DEMO");
    if (!completedOrder) {
        return res.status(409).json({ message: "This demo order could not be completed" });
    }

    res.json({
        orderId: completedOrder._id,
        paid: true,
        demo: true,
        message: "Demo order complete. No real payment was taken."
    });
});

export const verifyEsewaPayment = TryCatch(async(req, res) => {
    const { orderId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ message: "A valid order ID is required" });
    }

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
        return res.status(404).json({ message: "eSewa order not found" });
    }

    if (order.method === "demo") {
        return res.json({
            paid: order.paymentStatus === "paid",
            demo: true,
            message: order.paymentStatus === "paid"
                ? "Demo order complete. No real payment was taken."
                : "Demo payment has not been completed"
        });
    }

    if (order.method !== "esewa") {
        return res.status(404).json({ message: "eSewa order not found" });
    }

    if (order.paymentStatus === "paid") {
        return res.json({ paid: true, message: "Payment already verified" });
    }

    const { productCode, statusUrl } = getEsewaConfig();
    const query = new URLSearchParams({
        product_code: productCode,
        total_amount: order.subTotal.toFixed(2),
        transaction_uuid: order.transactionUUID
    });
    const response = await fetch(`${statusUrl}?${query}`, {
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        throw new Error(`eSewa status check failed with HTTP ${response.status}`);
    }

    const payment = await response.json();
    if (payment.status !== "COMPLETE") {
        return res.json({
            paid: false,
            status: payment.status || "UNKNOWN",
            message: "eSewa has not confirmed this payment"
        });
    }

    const receivedAmount = Number(String(payment.total_amount).replace(/,/g, ""));
    if (
        payment.product_code !== productCode ||
        payment.transaction_uuid !== order.transactionUUID ||
        !Number.isFinite(receivedAmount) ||
        Math.round(receivedAmount * 100) !== Math.round(order.subTotal * 100)
    ) {
        return res.status(400).json({ message: "eSewa payment details do not match this order" });
    }

    const updatedOrder = await finalizePaidOrder(order, req.user, payment.ref_id || "");
    if (!updatedOrder) {
        const latestOrder = await Order.findById(order._id);
        if (latestOrder?.paymentStatus === "paid") {
            return res.json({ paid: true, message: "Payment already verified" });
        }
        return res.status(409).json({ message: "This payment is already being processed" });
    }

    res.json({ paid: true, message: "Payment verified and order confirmed" });
});

export const newOrderCod = TryCatch(async(req, res)=>{
    const {method, phone, address} = req.body

    const cart = await Cart.find({user: req.user._id}).populate({
        path:"product",
        select:"title price"
    })

    if(!cart.length) return res.status(400).json({ message: "Cart is empty" })

     let subTotal = 0
     
     const items = cart.map((i)=>{
        const itemSubtotal = i.product.price * i.quantity
        
        subTotal += itemSubtotal

        return{
            product: i.product._id,
            name: i.product.title,
            price: i.product.price,
            quantity: i.quantity
        }
     })

    const order = await Order.create({
        items,
        method,
        user:req.user._id,
        phone,
        address,
        subTotal
    })

    for(let i of order.items){
        const product = await Product.findById(i.product)

        if(product){
            product.stock -= i.quantity;
            product.sold += i.quantity

            await product.save()
        }
    }

    await Cart.deleteMany({user: req.user._id})
    
    await sendOrderConfirmation({
        email: req.user.email,
        subject: "Order Confirmation",
        orderId: order._id,
        products: items,
        totalAmount: subTotal,
    })
    
    res.json({
        message:"Order createdd successfully",
        order
    })
})

export const getAllOrders = TryCatch(async(req, res)=>{
    const orders = await Order.find({
        user: req.user._id,
        ...getPlacedOrdersFilter()
    })
        .populate("items.product", "title")
        .sort({ createdAt: -1 })

    res.json({ orders })
})

export const getAllOrdersAdmin = TryCatch(async(req, res)=>{
    if(req.user.role !== "admin")
        return res.status(403).json({
         message: "you are not admin"
        })

        const orders = await Order.find(getPlacedOrdersFilter())
            .populate("user")
            .sort({createdAt: -1})

        res.json(orders)
})

export const getMyOrder = TryCatch(async(req, res)=>{
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "A valid order ID is required" });
    }

    const order = await Order.findOne({
        _id: req.params.id,
        user: req.user._id
    }).populate("items.product", "title price images")

    if (!order) {
        return res.status(404).json({ message: "Order not found" });
    }

    res.json({ order })
})

export const updateStatus = TryCatch(async(req, res)=>{
    if (req.user.role !== "admin")
        return res.status(403).json({
         message: "You are not admin"
        })

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "A valid order ID is required" });
    }

    const { status } = req.body;
    if (!["Pending", "Shipped", "Delivered"].includes(status)) {
        return res.status(400).json({ message: "A valid order status is required" });
    }

    const order = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: { status } },
        { new: true, runValidators: true }
    );
    if (!order) {
        return res.status(404).json({ message: "Order not found" });
    }

    res.json({
        message: "Order status updated",
        order
    });
})

export const getStats = TryCatch(async(req, res)=>{
    if(req.user.role !== "admin")
        return res.status(403).json({
         message: "you are not admin"
        })
    const cod = await Order.find({method:"cod"}).countDocuments()
    const online = await Order.countDocuments({
        $or: [
            { method: "online" },
            { method: { $in: ["esewa", "demo"] }, paymentStatus: "paid" }
        ]
    })

    const products = await Product.find()

    const data = products.map((prod)=>({
        name: prod.title,
        sold: prod.sold
}))

res.json({
    cod,
    online,
    data
})
})