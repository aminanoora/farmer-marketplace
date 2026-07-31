import { Response } from "express";
import Address from "../models/Address";
import { AuthRequest } from "../middleware/auth.middleware";

export const getAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const addresses = await Address.find({ user: req.user?._id }).sort("-isDefault -createdAt");
    res.json({ addresses });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { label, phone, street, city, state, pincode, isDefault } = req.body;
    if (!street || !city || !state || !pincode) {
      res.status(400).json({ message: "Street, city, state, and pincode are required." });
      return;
    }
    if (isDefault) {
      await Address.updateMany({ user: req.user?._id }, { isDefault: false });
    }
    const address = new Address({
      user: req.user?._id,
      label: label || "Home",
      phone,
      street, city, state, pincode,
      isDefault: isDefault ?? false,
    });
    await address.save();
    res.status(201).json({ address });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user?._id });
    if (!address) {
      res.status(404).json({ message: "Address not found." });
      return;
    }
    const { label, phone, street, city, state, pincode, isDefault } = req.body;
    if (isDefault) {
      await Address.updateMany({ user: req.user?._id, _id: { $ne: address._id } }, { isDefault: false });
    }
    if (label !== undefined) address.label = label;
    if (phone !== undefined) address.phone = phone;
    if (street !== undefined) address.street = street;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (pincode !== undefined) address.pincode = pincode;
    if (isDefault !== undefined) address.isDefault = isDefault;
    await address.save();
    res.json({ address });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user?._id });
    if (!address) {
      res.status(404).json({ message: "Address not found." });
      return;
    }
    res.json({ message: "Address deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const setDefaultAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user?._id });
    if (!address) {
      res.status(404).json({ message: "Address not found." });
      return;
    }
    await Address.updateMany({ user: req.user?._id }, { isDefault: false });
    address.isDefault = true;
    await address.save();
    res.json({ address });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
