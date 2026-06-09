import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/lib/api";
import { useCart } from "../../src/store/cart";
import { resolveImageUrl } from "../../src/lib/upload";
import { isLoggedIn } from "../../src/lib/session";
import { DailyOffersCarousel } from "../../src/components/DailyOffersCarousel";
import { PackagesCarousel } from "../../src/components/PackagesCarousel";
import { StarterMealsSection } from "../../src/components/StarterMealsSection";
import { HomeSectionHeader } from "../../src/components/HomeSectionHeader";
import { HomeProductCard, type HomeProduct } from "../../src/components/HomeProductCard";
import { useMobileLayout } from "../../src/lib/layout";
import { colors } from "../../src/theme/colors";
import { restaurantDeliveryMeta } from "../../src/lib/deliveryFee";
import { formatOfferDeliveryLabel } from "../../src/lib/deliveryOffer";
import { HOME_BANNERS, QUICK_CATEGORIES } from "../../src/data/homeMock";
import type { OfferSlot } from "../../src/types/offerSlot";
import type { Promotion } from "../../src/types/promotion";
import type { MealPackage } from "../../src/types/package";
import type { StarterMeal } from "../../src/types/starterMeal";
import { packageToCartLines } from "../../src/lib/addPackageToCart";
import {
  requestCustomerLocation,
  type CustomerLocation,
} from "../../src/lib/customerLocation";
import { CustomerLocationSheet } from "../../src/components/CustomerLocationSheet";
import { showAlert } from "../../src/lib/alert";

type Product = HomeProduct & {
  mealLabel: string;
  category?: string;
  offerDeliveryFee?: number | null;
  restaurant: HomeProduct["restaurant"] & { lat?: number; lng?: number };
};

type CategoryGroup = { category: string; products: Product[] };

type CatalogRestaurant = {
  id: string;
  name: string;
  logoUrl?: string | null;
  lat: number;
  lng: number;
};

type NearRestaurant = CatalogRestaurant & { eta: string; feeLabel: string };

const CATEGORY_EMOJI: Record<string, string> = {
  "وجبات سريعة": "🍟",
  حلى: "🍰",
  عربي: "🥙",
  صحي: "🥗",
  قهوة: "☕",
  مشويات: "🔥",
};

function categoryEmoji(name: string): string {
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (name.includes(key)) return emoji;
  }
  return "🍽️";
}

const QUICK_COMING_SOON = new Set(["market", "pharmacy", "flowers", "pickup"]);

const MEALS = [
  { key: "all", label: "الكل", emoji: "🍽️" },
  { key: "BREAKFAST", label: "فطور", emoji: "🌅" },
  { key: "LUNCH", label: "غداء", emoji: "☀️" },
  { key: "DINNER", label: "عشاء", emoji: "🌙" },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { productCardWidth, productImageHeight } = useMobileLayout();
  const add = useCart((s) => s.add);
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const [meal, setMeal] = useState<(typeof MEALS)[number]["key"]>("all");
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRestaurant, setIsRestaurant] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [previewCustomerHome, setPreviewCustomerHome] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [packages, setPackages] = useState<MealPackage[]>([]);
  const [starterMeals, setStarterMeals] = useState<StarterMeal[]>([]);
  const [starterFrom, setStarterFrom] = useState<number | null>(null);
  const [slotCounts, setSlotCounts] = useState<Partial<Record<OfferSlot, number>>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [customerCity, setCustomerCity] = useState<string | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [catalogRestaurants, setCatalogRestaurants] = useState<CatalogRestaurant[]>([]);
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [quickCategoryId, setQuickCategoryId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const locationPrompted = useRef(false);
  const quickCatDragged = useRef(false);

  const showCaptainHub = isCaptain;
  const showRestaurantHub = isRestaurant && !previewCustomerHome;
  const showCustomerBrowse = !isCaptain && (!isRestaurant || previewCustomerHome);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredPromotions = useMemo(() => {
    if (!normalizedSearch) return promotions;
    return promotions.filter(
      (p) =>
        p.product.name.toLowerCase().includes(normalizedSearch) ||
        p.restaurant.name.toLowerCase().includes(normalizedSearch) ||
        p.reason.toLowerCase().includes(normalizedSearch)
    );
  }, [promotions, normalizedSearch]);

  const filteredCategories = useMemo(() => {
    let groups = categories;
    if (cuisineFilter) {
      groups = groups.filter((g) => g.category === cuisineFilter);
    }
    if (!normalizedSearch) return groups;
    return groups
      .map((group) => ({
        ...group,
        products: group.products.filter(
          (p) =>
            p.name.toLowerCase().includes(normalizedSearch) ||
            p.restaurant.name.toLowerCase().includes(normalizedSearch) ||
            group.category.toLowerCase().includes(normalizedSearch)
        ),
      }))
      .filter((group) => group.products.length > 0);
  }, [categories, normalizedSearch, cuisineFilter]);

  const cuisineOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; label: string; emoji: string }[] = [];
    for (const group of categories) {
      if (seen.has(group.category)) continue;
      seen.add(group.category);
      options.push({
        id: group.category,
        label: group.category,
        emoji: categoryEmoji(group.category),
      });
    }
    return options;
  }, [categories]);

  const nearRestaurants = useMemo(() => {
    return catalogRestaurants.map((r) => {
      const meta = restaurantDeliveryMeta(
        r.lat,
        r.lng,
        customerCoords?.lat ?? null,
        customerCoords?.lng ?? null
      );
      return { ...r, ...meta };
    });
  }, [catalogRestaurants, customerCoords]);

  const pickProducts = useMemo(() => {
    const all = filteredCategories.flatMap((g) => g.products);
    return all.slice(0, 8);
  }, [filteredCategories]);

  const applyLocation = useCallback((loc: CustomerLocation) => {
    setCustomerCity(loc.city);
    setCustomerCoords({ lat: loc.lat, lng: loc.lng });
    return loc.city;
  }, []);

  const syncLocation = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLocating(true);
    try {
      const result = await requestCustomerLocation({
        force: false,
        allowIpEstimate: false,
      });
      if (result.location) {
        applyLocation(result.location);
        return result.location.city;
      }
      setCustomerCity(null);
      setCustomerCoords(null);
      if (!opts?.silent) {
        setLocationSheetOpen(true);
      }
      return null;
    } finally {
      if (!opts?.silent) setLocating(false);
      setLocationReady(true);
    }
  }, [applyLocation]);

  const loadPromotions = useCallback(async (city: string) => {
    try {
      const q = `?city=${encodeURIComponent(city)}`;
      const data = await api<{ promotions: Promotion[] }>(`/api/promotions${q}`, { auth: false });
      setPromotions(data.promotions);
    } catch {
      setPromotions([]);
    }
  }, []);

  const loadPackages = useCallback(async (city: string) => {
    try {
      const q = `?city=${encodeURIComponent(city)}`;
      const data = await api<{ packages: MealPackage[] }>(`/api/catalog/packages${q}`, {
        auth: false,
      });
      setPackages(data.packages);
    } catch {
      setPackages([]);
    }
  }, []);

  const loadSlotCounts = useCallback(async (city: string) => {
    try {
      const q = `?city=${encodeURIComponent(city)}`;
      const data = await api<{ counts: Record<OfferSlot, number> }>(
        `/api/promotions/slot-counts${q}`,
        { auth: false }
      );
      setSlotCounts(data.counts);
    } catch {
      setSlotCounts({});
    }
  }, []);

  const loadStarterMeals = useCallback(async (city: string) => {
    try {
      const q = `?city=${encodeURIComponent(city)}`;
      const data = await api<{ meals: StarterMeal[]; startingFrom: number | null }>(
        `/api/catalog/starter-meals${q}`,
        { auth: false }
      );
      setStarterMeals(data.meals);
      setStarterFrom(data.startingFrom);
    } catch {
      setStarterMeals([]);
      setStarterFrom(null);
    }
  }, []);

  const loadRestaurants = useCallback(async (city: string) => {
    try {
      const q = `?city=${encodeURIComponent(city)}`;
      const data = await api<{ restaurants: CatalogRestaurant[] }>(
        `/api/catalog/restaurants${q}`,
        { auth: false }
      );
      setCatalogRestaurants(data.restaurants);
    } catch {
      setCatalogRestaurants([]);
    }
  }, []);

  const load = useCallback(async (city: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const q = `?city=${encodeURIComponent(city)}`;
      const path =
        (meal === "all" ? "/api/catalog/aggregated" : `/api/catalog/by-meal/${meal}`) + q;
      const data = await api<{ categories: CategoryGroup[] }>(path, { auth: false });
      setCategories(data.categories);
    } catch {
      setCategories([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [meal]);

  const refreshAll = useCallback(async () => {
    if (!customerCity) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      await Promise.all([
        load(customerCity, { silent: true }),
        loadPromotions(customerCity),
        loadPackages(customerCity),
        loadRestaurants(customerCity),
        loadStarterMeals(customerCity),
        loadSlotCounts(customerCity),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [customerCity, load, loadPromotions, loadPackages, loadRestaurants, loadStarterMeals, loadSlotCounts]);

  useEffect(() => {
    if (!showCustomerBrowse || !locationReady || !customerCity) return;
    load(customerCity);
    loadPromotions(customerCity);
    loadPackages(customerCity);
    loadRestaurants(customerCity);
    loadStarterMeals(customerCity);
    loadSlotCounts(customerCity);
  }, [
    load,
    loadPromotions,
    loadPackages,
    loadRestaurants,
    loadStarterMeals,
    loadSlotCounts,
    showCustomerBrowse,
    locationReady,
    customerCity,
  ]);

  useEffect(() => {
    if (
      !showCustomerBrowse ||
      !locationReady ||
      customerCity ||
      locationPrompted.current
    ) {
      return;
    }
    locationPrompted.current = true;
    setLocationSheetOpen(true);
  }, [showCustomerBrowse, locationReady, customerCity]);

  useFocusEffect(
    useCallback(() => {
      if (showCustomerBrowse) {
        (async () => {
          await syncLocation({ silent: true });
        })();
      }
      (async () => {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
          setIsRestaurant(false);
          setIsCaptain(false);
          setRoleChecked(true);
          return;
        }
        try {
          const res = await api<{ user: { role: string } }>("/api/auth/me");
          setIsRestaurant(res.user.role === "RESTAURANT");
          setIsCaptain(res.user.role === "CAPTAIN");
        } catch {
          setIsRestaurant(false);
          setIsCaptain(false);
        } finally {
          setRoleChecked(true);
        }
      })();
    }, [syncLocation, showCustomerBrowse])
  );

  const addProductToCart = useCallback(
    (p: Product) => {
      add({
        productId: p.id,
        name: p.name,
        price: p.price,
        restaurantId: p.restaurant.id,
        restaurantName: p.restaurant.name,
        imageUrl: p.imageUrl,
      });
    },
    [add]
  );

  const addPackageToCart = useCallback(
    (pkg: MealPackage) => {
      for (const line of packageToCartLines(pkg)) {
        add(line, 1);
      }
    },
    [add]
  );

  const addPromotionToCart = useCallback(
    (p: Promotion) => {
      add({
        productId: p.productId,
        name: p.product.name,
        price: p.discountedPrice,
        restaurantId: p.restaurant.id,
        restaurantName: p.restaurant.name,
        imageUrl: p.product.imageUrl,
      });
    },
    [add]
  );

  const productDeliveryMeta = useCallback(
    (p: Product) => {
      const eta = restaurantDeliveryMeta(
        p.restaurant.lat ?? 0,
        p.restaurant.lng ?? 0,
        customerCoords?.lat ?? null,
        customerCoords?.lng ?? null
      ).eta;
      const feeLabel = formatOfferDeliveryLabel(p.offerDeliveryFee) ?? undefined;
      return { eta, feeLabel };
    },
    [customerCoords]
  );

  const starterDeliveryMeta = useCallback(
    (lat: number, lng: number, offerDeliveryFee?: number | null) => {
      const eta = restaurantDeliveryMeta(
        lat,
        lng,
        customerCoords?.lat ?? null,
        customerCoords?.lng ?? null
      ).eta;
      const feeLabel = formatOfferDeliveryLabel(offerDeliveryFee) ?? undefined;
      return { eta, feeLabel };
    },
    [customerCoords]
  );

  if (!roleChecked) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 6 }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (showCaptainHub) {
    return (
      <View
        style={[
          styles.container,
          styles.hubFill,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 80 },
        ]}
      >
        <View style={styles.captainHubCenter}>
          <Text style={styles.captainHubTitle}>لوحة الكابتن</Text>
          <Text style={styles.captainHubSubtitle}>إدارة التوصيل والطلبات من هنا</Text>

          <Pressable style={styles.captainHubBtn} onPress={() => router.push("/captain")}>
            <Text style={styles.captainHubBtnText}>🛵 لوحة الكابتن — الطلبات والإحصائيات</Text>
          </Pressable>
          <Pressable style={styles.captainHubBtnOutline} onPress={() => router.push("/account")}>
            <Text style={styles.captainHubBtnOutlineText}>حسابي</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (showRestaurantHub) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
        <ScrollView contentContainerStyle={styles.hubContent}>
          <Text style={styles.hubTitle}>لوحة المطعم</Text>
          <Text style={styles.hubSubtitle}>إدارة مطعمك من هنا</Text>

          <Pressable style={styles.hubBtn} onPress={() => router.push("/restaurant")}>
            <Text style={styles.hubBtnText}>لوحة المطعم</Text>
          </Pressable>
          <Pressable style={styles.hubBtn} onPress={() => router.push("/restaurant-products")}>
            <Text style={styles.hubBtnText}>المنتجات</Text>
          </Pressable>
          <Pressable style={styles.hubBtn} onPress={() => router.push("/restaurant-logo")}>
            <Text style={styles.hubBtnText}>شعار المتجر</Text>
          </Pressable>
          <Pressable style={styles.hubBtn} onPress={() => router.push("/add-product")}>
            <Text style={styles.hubBtnText}>إضافة منتج</Text>
          </Pressable>
          <Pressable style={styles.hubBtn} onPress={() => router.push("/add-combo-meal")}>
            <Text style={styles.hubBtnText}>إدارة الوجبات</Text>
          </Pressable>
          <Pressable style={styles.hubBtn} onPress={() => router.push("/add-promotion")}>
            <Text style={styles.hubBtnText}>إضافة عرض يومي</Text>
          </Pressable>
          <Pressable style={styles.hubBtn} onPress={() => router.push("/add-delivery-offer")}>
            <Text style={styles.hubBtnText}>عرض توصيل (عروض يومية)</Text>
          </Pressable>
          <Pressable style={styles.hubBtn} onPress={() => router.push("/add-package")}>
            <Text style={styles.hubBtnText}>إدارة البكجات</Text>
          </Pressable>
          <Pressable style={styles.hubBtnOutline} onPress={() => setPreviewCustomerHome(true)}>
            <Text style={styles.hubBtnOutlineText}>معاينة الواجهة الرئيسية</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {previewCustomerHome && (
        <Pressable style={styles.previewBar} onPress={() => setPreviewCustomerHome(false)}>
          <Text style={styles.previewBarText}>← العودة للوحة المطعم</Text>
        </Pressable>
      )}

      <View style={styles.topRow}>
        <Pressable
          style={styles.locationBlock}
          onPress={() => setLocationSheetOpen(true)}
          accessibilityRole="button"
        >
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationTitle}>
              {locating ? "جاري تحديد موقعك..." : customerCity ? customerCity : "حدّد موقع التوصيل"}
            </Text>
            <Text style={styles.locationSub}>
              {customerCity ? "📍 اضغط لتغيير الموقع" : "📍 اضغط لتحديد موقعك"}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
        {!isRestaurant && (
          <Link href="/cart" asChild>
            <Pressable style={styles.cartTextBtn} accessibilityLabel="العربة">
              <Ionicons name="cart-outline" size={22} color={colors.accentOrange} />
              {cartCount > 0 ? (
                <View style={styles.cartTextBadge}>
                  <Text style={styles.cartTextBadgeLabel}>{cartCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </Link>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textDim} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder="ابحث عن مطعم أو طبق..."
          placeholderTextColor={colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          textAlign="right"
        />
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[styles.mainContent, { paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshAll()}
            tintColor={colors.accentOrange}
          />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bannerRow}
          nestedScrollEnabled
        >
          {HOME_BANNERS.map((b) => {
            const isFast = b.id === "fast";
            const card = (
              <>
                <Text style={styles.bannerEmoji}>{b.emoji}</Text>
                <Text style={styles.bannerTitle}>{b.title}</Text>
                <Text style={styles.bannerSub}>
                  {isFast ? "اضغط لعرض المطاعم ضمن 3 كم" : b.subtitle}
                </Text>
              </>
            );
            if (isFast) {
              return (
                <Pressable
                  key={b.id}
                  style={[styles.bannerCard, { backgroundColor: b.accent ?? colors.bgCard }]}
                  onPress={() => router.push("/fast-delivery")}
                  accessibilityRole="button"
                  accessibilityLabel="توصيل أسرع — مطاعم قريبة"
                >
                  {card}
                </Pressable>
              );
            }
            return (
              <View
                key={b.id}
                style={[styles.bannerCard, { backgroundColor: b.accent ?? colors.bgCard }]}
              >
                {card}
              </View>
            );
          })}
        </ScrollView>

        <HomeSectionHeader title="وش ودك تطلب اليوم؟" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickCategoriesRow}
          nestedScrollEnabled
          directionalLockEnabled
          onScrollBeginDrag={() => {
            quickCatDragged.current = true;
          }}
          onScrollEndDrag={() => {
            setTimeout(() => {
              quickCatDragged.current = false;
            }, 80);
          }}
          onMomentumScrollEnd={() => {
            quickCatDragged.current = false;
          }}
        >
          {QUICK_CATEGORIES.map((c) => {
            const quickActive = quickCategoryId === c.id;
            const onQuickPress = () => {
              if (quickCatDragged.current) return;
              if (c.id === "sweets") {
                router.push("/coffee-sweets");
                return;
              }
              if (QUICK_COMING_SOON.has(c.id)) {
                showAlert("قريباً", "هذه الخدمة ستتوفر قريباً");
                return;
              }
              if (c.id === "restaurants") {
                setCuisineFilter(null);
                setQuickCategoryId((prev) => (prev === "restaurants" ? null : "restaurants"));
              }
            };
            return (
              <Pressable
                key={c.id}
                style={styles.quickCatWrap}
                onPress={onQuickPress}
                accessibilityRole="button"
              >
                <View style={[styles.quickCatBubble, quickActive && styles.quickCatBubbleActive]}>
                  <Text style={styles.quickCatEmoji}>{c.emoji}</Text>
                  {c.badge ? (
                    <View style={styles.quickCatBadge}>
                      <Text style={styles.quickCatBadgeText}>{c.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.quickCatLabel, quickActive && styles.quickCatLabelActive]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {packages.length > 0 ? (
          <PackagesCarousel
            packages={packages}
            showAddButton={!isRestaurant}
            onAddToCart={addPackageToCart}
            onPressRestaurant={(id) => router.push(`/menu/${id}`)}
          />
        ) : null}

        {starterMeals.length > 0 ? (
          <StarterMealsSection
            meals={starterMeals}
            startingFrom={starterFrom}
            showAdd={!isRestaurant}
            onAddToCart={addPromotionToCart}
            onPressRestaurant={(id) => router.push(`/menu/${id}`)}
            deliveryMeta={starterDeliveryMeta}
          />
        ) : null}

        <HomeSectionHeader title="وقت الوجبة" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mealBubbles}
          nestedScrollEnabled
        >
          {MEALS.map((m) => {
            const active = meal === m.key;
            return (
              <Pressable key={m.key} style={styles.bubbleWrap} onPress={() => setMeal(m.key)}>
                <View style={[styles.bubble, active && styles.bubbleActive]}>
                  <Text style={styles.bubbleEmoji}>{m.emoji}</Text>
                </View>
                <Text style={[styles.bubbleLabel, active && styles.bubbleLabelActive]}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <DailyOffersCarousel
          slotCounts={slotCounts}
          onOpenSlot={(slot) => router.push(`/daily-offers/${slot}`)}
          onOpenAll={() => router.push("/offers")}
        />

        {pickProducts.length > 0 && (
          <>
            <HomeSectionHeader title="مختارات لك" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productRow}
              nestedScrollEnabled
            >
              {pickProducts.map((p) => {
                const meta = productDeliveryMeta(p);
                return (
                  <HomeProductCard
                    key={`pick-${p.id}`}
                    product={p}
                    width={productCardWidth + 20}
                    imageHeight={productImageHeight + 16}
                    rich
                    showAdd={!isRestaurant}
                    etaLabel={meta.eta}
                    feeLabel={meta.feeLabel}
                    onAdd={() => addProductToCart(p)}
                    onPressRestaurant={() => router.push(`/menu/${p.restaurant.id}`)}
                  />
                );
              })}
            </ScrollView>
          </>
        )}

        <HomeSectionHeader title="مطاعم قريبة منك" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.restaurantRow}
          nestedScrollEnabled
        >
          {nearRestaurants.length === 0 ? (
            <Text style={styles.emptyInline}>لا توجد مطاعم في مدينتك حالياً</Text>
          ) : (
            nearRestaurants.map((r) => {
              const logo = resolveImageUrl(r.logoUrl);
              return (
                <Pressable
                  key={r.id}
                  style={styles.restaurantCard}
                  onPress={() => router.push(`/menu/${r.id}`)}
                >
                  <View style={styles.restaurantLogoWrap}>
                    {logo ? (
                      <Image source={{ uri: logo }} style={styles.restaurantLogo} resizeMode="cover" />
                    ) : (
                      <Text style={styles.restaurantLogoEmoji}>🍽️</Text>
                    )}
                  </View>
                  <Text style={styles.restaurantCardName} numberOfLines={2}>
                    {r.name}
                  </Text>
                  <Text style={styles.restaurantCardMeta}>🛵 {r.eta}</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {cuisineOptions.length > 0 ? (
          <>
            <HomeSectionHeader title="استكشف المطابخ" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cuisineRow}
              nestedScrollEnabled
            >
              {cuisineOptions.map((c) => {
                const active = cuisineFilter === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.cuisineChip, active && styles.cuisineChipActive]}
                    onPress={() => {
                      setQuickCategoryId(null);
                      setCuisineFilter(active ? null : c.id);
                    }}
                  >
                    <Text style={[styles.cuisineEmoji, active && styles.cuisineEmojiActive]}>
                      {c.emoji}
                    </Text>
                    <Text style={[styles.cuisineLabel, active && styles.cuisineLabelActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {normalizedSearch ? (
          <Text style={styles.searchHint}>
            نتائج البحث عن «{searchQuery.trim()}»
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.accent} />
        ) : filteredCategories.length === 0 ? (
          <Text style={styles.empty}>
            {normalizedSearch
              ? `لا توجد نتائج لـ «${searchQuery.trim()}»`
              : "لا توجد أصناف حالياً"}
          </Text>
        ) : (
          filteredCategories.map((group) => (
            <View key={group.category} style={styles.section}>
              <HomeSectionHeader title={group.category} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productRow}
                nestedScrollEnabled
              >
                {group.products.map((p) => {
                  const meta = productDeliveryMeta(p);
                  return (
                    <HomeProductCard
                      key={p.id}
                      product={p}
                      width={productCardWidth}
                      imageHeight={productImageHeight}
                      showAdd={!isRestaurant}
                      etaLabel={meta.eta}
                      feeLabel={meta.feeLabel}
                      onAdd={() => addProductToCart(p)}
                      onPressRestaurant={() => router.push(`/menu/${p.restaurant.id}`)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>

      <CustomerLocationSheet
        visible={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        onSaved={(loc) => {
          applyLocation(loc);
          setLocationReady(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  hubContent: { paddingTop: 32, paddingBottom: 40, paddingHorizontal: 0 },
  hubFill: { flex: 1, justifyContent: "flex-start" },
  captainHubCenter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  hubTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "right",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  hubSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "right",
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  hubBtn: {
    backgroundColor: colors.bgCard,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hubBtnText: { color: colors.accentOrange, fontWeight: "700", fontSize: 16 },
  hubBtnOutline: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 4,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.bgElevated,
  },
  hubBtnOutlineText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  captainHubTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  captainHubSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 28,
  },
  captainHubBtn: {
    backgroundColor: "#0077B6",
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  captainHubBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16, textAlign: "center" },
  captainHubBtnOutline: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0077B6",
    backgroundColor: colors.bgCard,
  },
  captainHubBtnOutlineText: { color: "#0077B6", fontWeight: "700", fontSize: 16 },
  previewBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  previewBarText: { color: colors.accent, fontWeight: "700", textAlign: "right", fontSize: 14 },
  topRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  locationBlock: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  locationTextWrap: { flex: 1 },
  locationTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "right",
  },
  locationSub: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
  },
  cartTextBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentOrange,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
    minWidth: 48,
  },
  cartTextBadge: {
    backgroundColor: colors.accentOrange,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartTextBadgeLabel: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: colors.searchBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  searchIcon: { marginLeft: 8 },
  search: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    textAlign: "right",
    fontSize: 14,
  },
  searchHint: {
    color: colors.textMuted,
    textAlign: "right",
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
  },
  mainScroll: { flex: 1 },
  mainContent: { paddingBottom: 16 },
  bannerRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  bannerCard: {
    width: 280,
    borderRadius: 16,
    padding: 18,
    minHeight: 120,
    justifyContent: "center",
  },
  bannerEmoji: { fontSize: 32, textAlign: "right", marginBottom: 8 },
  bannerTitle: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 18,
    textAlign: "right",
    marginBottom: 4,
  },
  bannerSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "right" },
  quickCategoriesRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 4,
    alignItems: "flex-start",
  },
  quickCatWrap: { alignItems: "center", width: 76 },
  quickCatBubble: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    position: "relative",
  },
  quickCatBubbleActive: {
    borderColor: colors.accentOrange,
    backgroundColor: "#2A1F18",
  },
  quickCatEmoji: { fontSize: 28 },
  quickCatBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    backgroundColor: colors.accentOrange,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  quickCatBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  quickCatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  quickCatLabelActive: { color: colors.accentOrange, fontWeight: "800" },
  restaurantRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  restaurantCard: {
    width: 140,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  restaurantLogoWrap: {
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  restaurantLogo: { width: "100%", height: "100%" },
  restaurantLogoEmoji: { fontSize: 32 },
  restaurantCardName: {
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
    fontSize: 13,
    minHeight: 36,
  },
  restaurantCardMeta: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  cuisineRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 8,
  },
  cuisineChip: { alignItems: "center", width: 72 },
  cuisineChipActive: { opacity: 1 },
  cuisineEmoji: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    lineHeight: 64,
    fontSize: 26,
    overflow: "hidden",
  },
  cuisineLabel: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  cuisineEmojiActive: { borderColor: colors.accent, borderWidth: 2 },
  cuisineLabelActive: { color: colors.accentOrange, fontWeight: "800" },
  emptyInline: {
    textAlign: "center",
    color: colors.textDim,
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 13,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    textAlign: "right",
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  mealBubbles: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 16,
  },
  bubbleWrap: { alignItems: "center", width: 72 },
  bubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bubble,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  bubbleActive: { borderWidth: 3, borderColor: colors.accent },
  bubbleEmoji: { fontSize: 28 },
  bubbleLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  bubbleLabelActive: { color: colors.accent },
  loader: { marginVertical: 32 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 16,
    marginBottom: 10,
    textAlign: "right",
    color: colors.text,
  },
  productRow: { paddingHorizontal: 16, gap: 10, flexDirection: "row-reverse" },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRich: { paddingBottom: 12 },
  cardImageWrap: { borderRadius: 10, overflow: "hidden", marginBottom: 8, position: "relative" },
  cardImage: { width: "100%", height: "100%" },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 32 },
  productName: {
    fontWeight: "700",
    textAlign: "right",
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
    minHeight: 38,
  },
  restaurantName: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginTop: 2 },
  price: {
    color: colors.accent,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "right",
    fontSize: 15,
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metaEta: { color: colors.textMuted, fontSize: 11 },
  metaFree: { color: "#5EB3E8", fontSize: 11, fontWeight: "700" },
  addFab: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  addFabText: { color: "#FFF", fontWeight: "800", fontSize: 20, lineHeight: 22 },
  addBtn: {
    backgroundColor: colors.accentOrange,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  addBtnText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", marginVertical: 32, color: colors.textDim, fontSize: 15 },
});
