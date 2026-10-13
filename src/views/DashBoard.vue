<template lang="html">
  <div class="flex flex-row h-screen">
    <div class="flex-[2] bg-red-200">
      Customer Report (incomplete, complete one goes to the customer SCR database, this is for main
      job)
    </div>
    <div class="flex-1 bg-green-200">
      Customer Report SCR (incomplete, complete one goes to the customer SCR database)
    </div>
    <div class="w-[400px] shrink-0 min-w-0 overflow-hidden"><LowStockView /></div>
  </div>
</template>
<script setup lang="ts"></script>
<style lang="scss"></style>
