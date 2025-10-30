import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { getExchangeRate } from "../../../utils/exchangeRate.js";

/**
 * בודק אם הצעה היא ההצעה הכי נמוכה למשחק
 * @param {Object} offer - ההצעה לבדוק (חייבת לכלול: price, currency)
 * @param {string} fixtureId - מזהה המשחק
 * @returns {Promise<Object>} - { isLowest: boolean, lowestPriceInEUR: number, totalOffers: number }
 */
export const isLowestOffer = async (offer, fixtureId) => {
  try {
    const { price, currency } = offer;
    const newOfferCurrency = currency || "EUR";
    const newOfferPrice = price;

    logWithCheckpoint(
      "info",
      "Checking if offer is the lowest for fixture",
      "OFFER_COMPARE_001",
      {
        fixtureId,
        offerPrice: newOfferPrice,
        offerCurrency: newOfferCurrency,
      }
    );

    // שליפת כל ההצעות הקיימות למשחק
    const allOffers = await Offer.find({ fixtureId, isAvailable: true }).sort({
      price: 1,
    });

    // אם אין הצעות אחרות, זו בהכרח ההצעה הכי נמוכה
    if (allOffers.length === 0) {
      logWithCheckpoint(
        "info",
        "First offer for fixture - is lowest by default",
        "OFFER_COMPARE_002",
        {
          fixtureId,
          newOfferPrice,
          newOfferCurrency,
        }
      );

      return {
        isLowest: true,
        lowestPriceInEUR: newOfferPrice,
        totalOffers: 0,
        newPriceInEUR: newOfferPrice,
      };
    }

    // המרת כל המחירים לאותו מטבע בסיס (EUR) להשוואה
    const pricesInBaseCurrency = await Promise.all(
      allOffers.map(async (existingOffer) => {
        if (existingOffer.currency === "EUR") {
          return existingOffer.price;
        }
        try {
          const rate = await getExchangeRate(existingOffer.currency, "EUR");
          return existingOffer.price * rate;
        } catch (error) {
          logError(error, {
            operation: "convertPriceForComparison",
            offerId: existingOffer._id,
            currency: existingOffer.currency,
          });
          // אם ההמרה נכשלה, מחזירים את המחיר המקורי
          return existingOffer.price;
        }
      })
    );

    // המרת המחיר החדש ל-EUR
    let newPriceInEUR = newOfferPrice;
    if (newOfferCurrency !== "EUR") {
      try {
        const rate = await getExchangeRate(newOfferCurrency, "EUR");
        newPriceInEUR = newOfferPrice * rate;
      } catch (error) {
        logError(error, {
          operation: "convertNewOfferPrice",
          currency: newOfferCurrency,
        });
        newPriceInEUR = newOfferPrice;
      }
    }

    const lowestPriceInBaseCurrency = Math.min(...pricesInBaseCurrency);
    const isLowest = newPriceInEUR <= lowestPriceInBaseCurrency;

    logWithCheckpoint(
      "info",
      "Price comparison completed",
      "OFFER_COMPARE_003",
      {
        fixtureId,
        newOfferPrice,
        newOfferCurrency,
        newPriceInEUR,
        lowestPriceInBaseCurrency,
        isLowest,
        totalOffers: allOffers.length,
      }
    );

    return {
      isLowest,
      lowestPriceInEUR: lowestPriceInBaseCurrency,
      totalOffers: allOffers.length,
      newPriceInEUR,
    };
  } catch (error) {
    logError(error, {
      operation: "isLowestOffer",
      fixtureId,
      offer,
    });

    // במקרה שגיאה, נחזיר false כדי שלא נעדכן cache
    return {
      isLowest: false,
      lowestPriceInEUR: null,
      totalOffers: 0,
      newPriceInEUR: null,
    };
  }
};

/**
 * מוצא את ההצעה הכי זולה למשחק (לאחר המרת מטבעות)
 * @param {string} fixtureId - מזהה המשחק
 * @returns {Promise<Object|null>} - ההצעה הכי זולה או null אם אין הצעות
 */
export const getLowestOffer = async (fixtureId) => {
  try {
    // שליפת כל ההצעות הקיימות למשחק
    const allOffers = await Offer.find({
      fixtureId,
      isAvailable: true,
    }).lean();

    if (allOffers.length === 0) {
      return null;
    }

    // המרת כל המחירים לאותו מטבע בסיס (EUR) להשוואה
    const offersWithEURPrice = await Promise.all(
      allOffers.map(async (offer) => {
        let priceInEUR = offer.price;
        if (offer.currency !== "EUR") {
          try {
            const rate = await getExchangeRate(offer.currency, "EUR");
            priceInEUR = offer.price * rate;
          } catch (error) {
            logError(error, {
              operation: "convertOfferPriceForLowest",
              offerId: offer._id,
              currency: offer.currency,
            });
            // אם ההמרה נכשלה, משתמשים במחיר המקורי
            priceInEUR = offer.price;
          }
        }
        return {
          ...offer,
          priceInEUR,
        };
      })
    );

    // מציאת ההצעה עם המחיר הנמוך ביותר
    const lowestOffer = offersWithEURPrice.reduce((prev, current) =>
      prev.priceInEUR <= current.priceInEUR ? prev : current
    );

    return {
      offer: lowestOffer,
      priceInEUR: lowestOffer.priceInEUR,
    };
  } catch (error) {
    logError(error, {
      operation: "getLowestOffer",
      fixtureId,
    });
    return null;
  }
};
