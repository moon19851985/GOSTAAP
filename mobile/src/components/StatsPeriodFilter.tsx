import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import type { StatsPeriod } from "../lib/statsPeriod";
import { colors } from "../theme/colors";

type Theme = "captain" | "restaurant";
type Surface = "light" | "dark";

type Props = {
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
  month: string;
  year: string;
  date: string;
  onMonthChange: (v: string) => void;
  onYearChange: (v: string) => void;
  onDateChange: (v: string) => void;
  theme?: Theme;
  surface?: Surface;
};

const FILTERS: { key: StatsPeriod; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "year", label: "السنة" },
  { key: "month", label: "الشهر" },
  { key: "day", label: "اليوم" },
];

export function StatsPeriodFilter({
  period,
  onPeriodChange,
  month,
  year,
  date,
  onMonthChange,
  onYearChange,
  onDateChange,
  theme = "captain",
  surface = "light",
}: Props) {
  const accent = theme === "restaurant" ? "#E85D04" : "#0077B6";
  const chipActiveBg = accent;
  const chipBorder = accent;
  const chipText = accent;
  const isDark = surface === "dark";

  return (
    <View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = period === f.key;
          return (
            <Pressable
              key={f.key}
              style={[
                styles.chip,
                isDark && styles.chipDark,
                { borderColor: chipBorder },
                active && { backgroundColor: chipActiveBg },
              ]}
              onPress={() => onPeriodChange(f.key)}
            >
              <Text style={[styles.chipText, { color: active ? "#FFF" : chipText }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {period === "year" && (
        <View style={styles.pickerBlock}>
          <Text style={[styles.pickerLabel, isDark && styles.pickerLabelDark]}>
            اختر السنة (مثال: 2026)
          </Text>
          <TextInput
            style={[styles.pickerInput, isDark && styles.pickerInputDark]}
            value={year}
            onChangeText={onYearChange}
            placeholder="2026"
            placeholderTextColor={isDark ? colors.textDim : undefined}
            keyboardType="number-pad"
            textAlign="right"
            maxLength={4}
          />
        </View>
      )}

      {period === "month" && (
        <View style={styles.pickerBlock}>
          <Text style={[styles.pickerLabel, isDark && styles.pickerLabelDark]}>
            اختر الشهر (مثال: 2026-05)
          </Text>
          <TextInput
            style={[styles.pickerInput, isDark && styles.pickerInputDark]}
            value={month}
            onChangeText={onMonthChange}
            placeholder="2026-05"
            placeholderTextColor={isDark ? colors.textDim : undefined}
            textAlign="right"
            maxLength={7}
          />
        </View>
      )}

      {period === "day" && (
        <View style={styles.pickerBlock}>
          <Text style={[styles.pickerLabel, isDark && styles.pickerLabelDark]}>
            اختر اليوم (مثال: 2026-05-31)
          </Text>
          <TextInput
            style={[styles.pickerInput, isDark && styles.pickerInputDark]}
            value={date}
            onChangeText={onDateChange}
            placeholder="2026-05-31"
            placeholderTextColor={isDark ? colors.textDim : undefined}
            textAlign="right"
            maxLength={10}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
  },
  chipDark: { backgroundColor: colors.bgElevated },
  chipText: { fontWeight: "600", fontSize: 13 },
  pickerBlock: { marginTop: 8, marginBottom: 4 },
  pickerLabel: { textAlign: "right", color: "#666", fontSize: 13, marginBottom: 6 },
  pickerLabelDark: { color: colors.textMuted },
  pickerInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FFF",
    fontSize: 15,
  },
  pickerInputDark: {
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: colors.bgElevated,
    color: colors.text,
  },
});
