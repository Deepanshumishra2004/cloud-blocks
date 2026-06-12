import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { useRef, useState } from 'react';

import { ONBOARDING_SLIDES } from '../onboarding-data';
import { BrandLockup } from './brand-lockup';
import { ScreenShell } from './screen-shell';
import { ThemeToggle } from './theme-toggle';
import type { ThemeMode } from '../types';

const { width } = Dimensions.get('window');

type OnboardingCarouselProps = {
  onDone: () => void;
  mode: ThemeMode;
  onToggleTheme: () => void;
};

export function OnboardingCarousel({ onDone, mode, onToggleTheme }: OnboardingCarouselProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isDark = mode === 'dark';

  function goNext() {
    if (slideIndex >= ONBOARDING_SLIDES.length - 1) {
      onDone();
      return;
    }

    const nextIndex = slideIndex + 1;
    scrollRef.current?.scrollTo({ x: width * nextIndex, animated: true });
    setSlideIndex(nextIndex);
  }

  return (
    <ScreenShell mode={mode}>
      <View className={isDark ? 'min-h-[60px] flex-row items-center gap-3 border-b border-[#111827] bg-cb-page px-4 py-2' : 'min-h-[60px] flex-row items-center gap-3 border-b border-[#e5e7eb] bg-[#f7f9fc] px-4 py-2'}>
        <BrandLockup mode={mode} />
        <View className="shrink-0 flex-row items-center gap-2">
          <ThemeToggle mode={mode} onToggle={onToggleTheme} />
          <Pressable hitSlop={10} onPress={onDone} className="h-8 min-w-[42px] items-center justify-center">
            <Text className={isDark ? 'text-sm font-bold text-cb-muted' : 'text-sm font-bold text-[#718198]'}>Skip</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          setSlideIndex(Math.round(event.nativeEvent.contentOffset.x / width));
        }}>
        {ONBOARDING_SLIDES.map(({ key, Visual, eyebrow, title, description, detail, features, accentClassName }) => (
          <View key={key} className="flex-1 justify-center px-[22px] pb-4 pt-3" style={{ width }}>
            <View className="mb-4">
              <Text className={`mb-2 text-[11px] font-black uppercase tracking-[1.5px] ${accentClassName}`}>
                {eyebrow}
              </Text>
              <Text className={isDark ? 'max-w-[340px] text-[28px] font-black leading-[32px] text-cb-primary' : 'max-w-[340px] text-[28px] font-black leading-[32px] text-[#0d1726]'}>
                {title}
              </Text>
              <Text className={isDark ? 'mt-3 max-w-[345px] text-[14px] font-semibold leading-5 text-cb-secondary' : 'mt-3 max-w-[345px] text-[14px] font-semibold leading-5 text-[#46566d]'}>
                {description}
              </Text>
              <Text className={isDark ? 'mt-2 max-w-[345px] text-[12px] font-medium leading-[18px] text-cb-muted' : 'mt-2 max-w-[345px] text-[12px] font-medium leading-[18px] text-[#667085]'}>
                {detail}
              </Text>
            </View>

            <View className={isDark ? 'w-full max-w-[390px] rounded-lg border border-white/10 bg-black p-3 shadow-2xl shadow-black' : 'w-full max-w-[390px] rounded-lg border border-[#d5e0ee] bg-white p-3 shadow-2xl shadow-black/10'}>
              <View className="h-[292px]">
                <Visual />
              </View>
              <View className="mt-3 gap-2">
                {features.map((feature) => (
                  <View key={feature} className={isDark ? 'rounded-md border border-white/10 bg-white/[0.05] px-3 py-2' : 'rounded-md border border-[#d5e0ee] bg-[#f7f9fc] px-3 py-2'}>
                    <Text className={isDark ? 'text-[11px] font-extrabold text-cb-secondary' : 'text-[11px] font-extrabold text-[#46566d]'}>
                      + {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row items-center justify-between px-5 pb-6 pt-2.5">
        <View className="flex-row gap-2">
          {ONBOARDING_SLIDES.map((slide, index) => (
            <View
              key={slide.key}
              className={index === slideIndex ? 'h-[7px] w-6 rounded-full bg-accent-orange' : 'h-[7px] w-[7px] rounded-full bg-cb-border-strong'}
            />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          className="h-[46px] min-w-[124px] items-center justify-center rounded-lg border border-white/15 bg-white px-5 shadow-lg shadow-black active:opacity-80">
          <Text className="text-[15px] font-extrabold text-black">
            {slideIndex === ONBOARDING_SLIDES.length - 1 ? 'Continue' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}
