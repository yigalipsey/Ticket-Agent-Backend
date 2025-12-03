export const toObjectIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value._id) {
    return value._id.toString();
  }

  if (typeof value.toString === "function") {
    return value.toString();
  }

  return null;
};

export const attachLegacyOwnerFields = (offer) => {
  if (!offer) {
    return offer;
  }

  if (offer.ownerType === "Agent" && offer.ownerId) {
    return {
      ...offer,
      agentId: offer.ownerId,
    };
  }

  if (offer.ownerType === "Supplier" && offer.ownerId) {
    return {
      ...offer,
      supplierId: offer.ownerId,
    };
  }

  return offer;
};

const getLogoUrl = (owner) => {
  if (!owner) {
    return null;
  }

  const metadata = owner.metadata;
  if (typeof metadata?.get === "function") {
    const metaLogo = metadata.get("logoUrl") || metadata.get("imageUrl");
    if (metaLogo) {
      return metaLogo;
    }
  } else if (metadata) {
    if (metadata.logoUrl) {
      return metadata.logoUrl;
    }
    if (metadata.imageUrl) {
      return metadata.imageUrl;
    }
  }

  if (owner.logoUrl) {
    return owner.logoUrl;
  }

  if (owner.imageUrl) {
    return owner.imageUrl;
  }

  return null;
};

const getImageUrl = (owner) => {
  if (!owner) {
    return null;
  }

  const metadata = owner.metadata;
  if (typeof metadata?.get === "function") {
    const metaImage = metadata.get("imageUrl") || metadata.get("logoUrl");
    if (metaImage) {
      return metaImage;
    }
  } else if (metadata) {
    if (metadata.imageUrl) {
      return metadata.imageUrl;
    }
    if (metadata.logoUrl) {
      return metadata.logoUrl;
    }
  }

  if (owner.imageUrl) {
    return owner.imageUrl;
  }

  if (owner.logoUrl) {
    return owner.logoUrl;
  }

  return null;
};

const resolveOwnerObject = (offer) => {
  if (!offer) return null;

  const populatedOwner =
    offer.ownerId ||
    (offer.ownerType === "Supplier" ? offer.supplierId : offer.agentId);

  if (!populatedOwner || typeof populatedOwner !== "object") {
    return null;
  }

  const ownerId = toObjectIdString(populatedOwner._id || populatedOwner.id);

  const baseOwnerData = {
    id: ownerId,
    name:
      populatedOwner.name ||
      populatedOwner.companyName ||
      populatedOwner.email ||
      "Agent",
    slug: populatedOwner.slug || null,
    logoUrl: getLogoUrl(populatedOwner),
    imageUrl: getImageUrl(populatedOwner),
  };

  if (offer.ownerType === "Supplier") {
    baseOwnerData.trustpilotRating =
      typeof populatedOwner.trustpilotRating === "number"
        ? populatedOwner.trustpilotRating
        : null;
    baseOwnerData.trustpilotUrl = populatedOwner.trustpilotUrl || null;
  }

  return baseOwnerData;
};

export const formatOfferForResponse = (offer) => {
  if (!offer) {
    return null;
  }

  const owner = resolveOwnerObject(offer);
  const url = offer.url || null;
  const fallbackContact =
    !url && offer.ownerType === "Agent"
      ? offer.ownerId?.whatsapp || offer.agentId?.whatsapp || null
      : null;

  return {
    id: toObjectIdString(offer._id),
    fixtureId: toObjectIdString(offer.fixtureId),
    ownerType: offer.ownerType,
    price: offer.price,
    currency: offer.currency,
    url,
    fallbackContact,
    isAvailable: offer.isAvailable,
    ticketType: offer.ticketType,
    isHospitality: offer.isHospitality,
    notes: offer.notes || null,
    owner,
  };
};
