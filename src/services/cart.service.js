const httpStatus = require("http-status");
const { Cart, Product } = require("../models");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");


/**
 * Fetches cart for a user
 * - Fetch user's cart from Mongo
 * - If cart doesn't exist, throw ApiError
 * --- status code  - 404 NOT FOUND
 * --- message - "User does not have a cart"
 *
 * @param {User} user
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const getCartByUser = async (user) => {
  let email = user.email;
  let userCart = await Cart.findOne({email: email}).exec();
  if( userCart) return new Promise(resolve => resolve(userCart));
  else throw new ApiError(httpStatus.NOT_FOUND, "User does not have a cart");
  


};

/**
 * Adds a new product to cart
 * - Get user's cart object using "Cart" model's findOne() method
 * --- If it doesn't exist, create one
 * --- If cart creation fails, throw ApiError with "500 Internal Server Error" status code
 *
 * - If product to add already in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product already in cart. Use the cart sidebar to update or remove product from cart"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - Otherwise, add product to user's cart
 *
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const addProductToCart = async (user, productId, quantity) => {
  let prod = await Product.findOne({_id: productId}).exec();
  if(!prod) throw new ApiError(400, "Product doesn't exist in database");
  
  let email = user.email;
  let userCart = await Cart.findOne({email: email}).exec();
  if( !userCart) {
    console.log("creating new cart for user")
    userCart = await Cart.create({ "email":  email , cartItems : [] });
    if( !userCart) throw new ApiError(500, "Internal Server Error");
  }
  //console.log(userCart.cartItems.filter( item => item.product_id == productId));
  if(userCart.cartItems.filter( item => item.product._id == productId).length != 0){
    throw new ApiError(400, "Product already in cart. Use the cart sidebar to update or remove product from cart");
  }

  userCart.cartItems.push({product: prod , quantity : quantity});
  await userCart.save();

  return new Promise(resolve => resolve(userCart));
  
};

/**
 * Updates the quantity of an already existing product in cart
 * - Get user's cart object using "Cart" model's findOne() method
 * - If cart doesn't exist, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart. Use POST to create cart and add a product"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * - Otherwise, update the product's quantity in user's cart to the new quantity provided and return the cart object
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>
 * @throws {ApiError}
 */
const updateProductInCart = async (user, productId, quantity) => {

  let prod = await Product.findOne({_id: productId}).exec();
  if(!prod) throw new ApiError(400, "Product doesn't exist in database");
  
  let email = user.email;
  let userCart = await Cart.findOne({email: email}).exec();
  if( !userCart) {
    throw new ApiError(400, "User does not have a cart. Use POST to create cart and add a product");
  }
  let updateProduct = userCart.cartItems.filter( item => item.product._id == productId);
  //console.log(updateProduct);

  if( updateProduct.length == 0)
    throw new ApiError(400, "Product not in cart");
  
  if( quantity <= 0){
    //delete the product
    return deleteProductFromCart(user, productId);
  }
  updateProduct[0].quantity = quantity;
  await userCart.save();
  return new Promise(resolve => resolve(userCart));

};

/**
 * Deletes an already existing product in cart
 * - If cart doesn't exist for user, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * Otherwise, remove the product from user's cart
 *
 *
 * @param {User} user
 * @param {string} productId
 * @throws {ApiError}
 */
const deleteProductFromCart = async (user, productId) => {
  let email = user.email;
  let userCart = await Cart.findOne({email: email}).exec();
  if( !userCart) {
    throw new ApiError(400, "User does not have a cart");
  }
  let updateProduct = userCart.cartItems.filter( item => item.product._id == productId);
  //console.log(updateProduct);

  if( !updateProduct)
    throw new ApiError(400, "Product not in cart");
  
    userCart.cartItems = userCart.cartItems.filter( item => item.product._id != productId);
    await userCart.save();
    return new Promise(resolve => resolve(userCart));

};



// TODO: CRIO_TASK_MODULE_TEST - Implement checkout function
/**
 * Checkout a users cart.
 * On success, users cart must have no products.
 *
 * @param {User} user
 * @returns {Promise}
 * @throws {ApiError} when cart is invalid
 */
const checkout = async (user) => {
  //console.log(user);

  let userCart = await getCartByUser(user);
  if( userCart.cartItems.length == 0){
    throw new ApiError(httpStatus.BAD_REQUEST , "Cart is Empty");
  }


  let address = await user.hasSetNonDefaultAddress();
  if( !address ) {
    //console.log("before");
    throw new ApiError(httpStatus.BAD_REQUEST , "Address not set");
  }
  //console.log("Past 1");
  
  let totalBill = await userCart.cartItems.reduce( (sum , item )=>{
    return sum += item.quantity * item.product.cost;
    }, 0);
  //console.log("BILL:",totalBill);
  //console.log("AVAIL MONEY:",user.walletMoney);
  
  if( totalBill > user.walletMoney){
    throw new ApiError(httpStatus.BAD_REQUEST , "Insuficient Balance");
  }

  user.walletMoney -= totalBill;
  userCart.cartItems = [];
  await userCart.save();
  await user.save();
  return userCart;


};

module.exports = {
  getCartByUser,
  addProductToCart,
  updateProductInCart,
  deleteProductFromCart,
  checkout,
};
